import { BadRequestError, ConflictError, NotFoundError } from "@/server/core/errors";
import { createLogger } from "@/server/core/logger";
import { decrypt, encrypt, isEncryptionConfigured, mask } from "@/server/core/crypto";
import { storeRepository } from "@/server/repositories/store.repository";
import {
  CONNECTOR_CATALOG,
  findConnectorDefinition,
  type ConnectorDefinition,
} from "@/server/providers/catalog";
import { providerRegistry } from "@/server/providers/registry";
import type { HealthReport, ConnectorContext } from "@/server/providers/types";
import type { Store } from "@prisma/client";

const log = createLogger("services.connector");

export interface TestResult {
  ok: boolean;
  message: string;
  latencyMs: number;
  checkedAt: string;
}

/**
 * Instalação de conectores de loja.
 *
 * O ponto central do desenho: **testar não depende do banco**. O operador cola
 * as chaves, o sistema fala com a loja real e responde se funcionou — antes de
 * qualquer gravação. Assim, credencial errada nunca chega a ser persistida, e o
 * teste funciona mesmo com o Postgres fora.
 *
 * A gravação, essa sim, exige banco: cria a `Store` e as `StoreCredential`
 * criptografadas, na mesma transação. Meia instalação — loja sem credencial —
 * seria pior que instalação nenhuma.
 */
export class ConnectorService {
  catalog() {
    return CONNECTOR_CATALOG.map((definition) => ({
      ...definition,
      registrado: providerRegistry.has(definition.key),
    }));
  }

  /** Valida os campos obrigatórios declarados no catálogo. */
  private validateCredentials(
    definition: ConnectorDefinition,
    credentials: Record<string, string>,
  ) {
    const missing = definition.credentialFields
      .filter((f) => f.required && !credentials[f.id]?.trim())
      .map((f) => f.label);

    if (missing.length) {
      throw new BadRequestError(
        `Preencha os campos obrigatórios: ${missing.join(", ")}`,
        { campos: missing },
      );
    }
  }

  /**
   * Testa credenciais contra a loja real, sem gravar nada.
   */
  async test(connectorKey: string, credentials: Record<string, string>): Promise<TestResult> {
    const definition = findConnectorDefinition(connectorKey);
    if (!definition) throw new NotFoundError("Conector", connectorKey);

    if (definition.status === "planejado") {
      throw new BadRequestError(
        `O conector "${definition.storeName}" ainda não foi implementado.`,
      );
    }

    this.validateCredentials(definition, credentials);

    const connector = providerRegistry.tryGet(connectorKey);
    if (!connector) {
      throw new NotFoundError("Conector registrado", connectorKey);
    }

    const started = Date.now();
    let report: HealthReport;

    try {
      report = await connector.healthCheck({
        storeId: `teste-${connectorKey}`,
        storeSlug: definition.storeSlug,
        credentials,
        config: {},
      });
    } catch (e) {
      // healthCheck bem-comportado não lança, mas um conector novo pode lançar.
      return {
        ok: false,
        message: e instanceof Error ? e.message : "Falha desconhecida no teste",
        latencyMs: Date.now() - started,
        checkedAt: new Date().toISOString(),
      };
    } finally {
      await connector.dispose?.({
        storeId: `teste-${connectorKey}`,
        storeSlug: definition.storeSlug,
        credentials,
        config: {},
      });
    }

    log.info("Teste de conexão executado", {
      conector: connectorKey,
      resultado: report.healthy ? "sucesso" : "falha",
      latencyMs: report.latencyMs,
    });

    return {
      ok: report.healthy,
      message: report.message ?? (report.healthy ? "Conexão estabelecida" : "Falha na conexão"),
      latencyMs: report.latencyMs,
      checkedAt: report.checkedAt.toISOString(),
    };
  }

  /**
   * Instala o conector: cria a loja e grava as credenciais criptografadas.
   * O teste é refeito aqui — as chaves podem ter sido editadas depois do
   * último teste na interface, e instalar uma credencial não testada
   * derrotaria o propósito do fluxo.
   */
  async install(input: {
    connectorKey: string;
    credentials: Record<string, string>;
    displayName?: string;
    skipTest?: boolean;
  }) {
    const definition = findConnectorDefinition(input.connectorKey);
    if (!definition) throw new NotFoundError("Conector", input.connectorKey);

    this.validateCredentials(definition, input.credentials);

    const hasSecrets = definition.credentialFields.some((f) => f.secret);
    if (hasSecrets && !isEncryptionConfigured()) {
      throw new BadRequestError(
        "CREDENTIALS_ENCRYPTION_KEY não configurada — sem ela as chaves não podem ser " +
          "gravadas com segurança. Gere uma e reinicie o servidor.",
      );
    }

    if (!input.skipTest) {
      const result = await this.test(input.connectorKey, input.credentials);
      if (!result.ok) {
        throw new BadRequestError(`A conexão falhou: ${result.message}`);
      }
    }

    const slug = definition.storeSlug;
    const existing = await storeRepository.findBySlug(slug);
    if (existing) {
      throw new ConflictError(
        `A loja "${definition.storeName}" já está instalada. Edite as credenciais em vez de adicionar de novo.`,
      );
    }

    const store = await storeRepository.installStoreWithCredentials(
      {
        slug,
        name: input.displayName?.trim() || definition.storeName,
        connectorKey: definition.key,
        integrationType: definition.integrationType,
        accentColor: definition.accentColor,
        status: "ACTIVE",
        isActive: true,
        healthStatus: "HEALTHY",
        lastSuccessAt: new Date(),
      },
      input.credentials,
      definition
    );

    log.success("Conector instalado", {
      loja: store.slug,
      conector: definition.key,
      credenciais: definition.credentialFields.length,
    });

    return store;
  }

  /** Credenciais de uma loja, com os segredos mascarados. */
  async listCredentials(storeId: string) {
    const rows = await storeRepository.listCredentials(storeId);

    const store = await storeRepository.findById(storeId);
    const definition = store ? findConnectorDefinition(store.connectorKey) : undefined;

    return rows.map((row) => {
      const field = definition?.credentialFields.find((f) => f.id === row.key);
      const isSecret = field?.secret ?? true;

      return {
        key: row.key,
        label: field?.label ?? row.key,
        secret: isSecret,
        version: row.version,
        updatedAt: row.createdAt,
        // Segredo nunca sai em claro: mostra-se apenas o suficiente para
        // reconhecer qual chave está gravada.
        preview: isSecret ? this.previewSecret(row.valueEncrypted) : row.valueEncrypted,
      };
    });
  }

  /** Carrega as credenciais em claro — uso exclusivo dos conectores. */
  async loadCredentials(storeId: string): Promise<Record<string, string>> {
    const store = await storeRepository.findById(storeId);
    if (!store) throw new NotFoundError("Loja", storeId);

    const definition = findConnectorDefinition(store.connectorKey);
    return storeRepository.loadCredentials(storeId, definition);
  }

  /** Reconstrói o contexto do conector com credenciais descriptografadas. */
  async buildContext(store: Store): Promise<ConnectorContext> {
    const credentials = await this.loadCredentials(store.id);
    return {
      storeId: store.id,
      storeSlug: store.slug,
      credentials,
      config: (store.config as Record<string, unknown>) || {},
    };
  }

  /** Rotação: a credencial antiga é marcada, nunca sobrescrita. */
  async rotateCredentials(storeId: string, credentials: Record<string, string>) {
    const store = await storeRepository.findById(storeId);
    if (!store) throw new NotFoundError("Loja", storeId);

    const definition = findConnectorDefinition(store.connectorKey);
    if (!definition) throw new NotFoundError("Conector", store.connectorKey);

    const merged = { ...(await this.loadCredentials(storeId)), ...credentials };
    const result = await this.test(store.connectorKey, merged);
    if (!result.ok) throw new BadRequestError(`A conexão falhou: ${result.message}`);

    await storeRepository.rotateCredentials(storeId, credentials, definition);

    log.success("Credenciais rotacionadas", { loja: store.slug });
    return result;
  }

  private previewSecret(stored: string): string {
    try {
      return mask(decrypt(stored));
    } catch {
      return "••••••••";
    }
  }
}

export const connectorService = new ConnectorService();
