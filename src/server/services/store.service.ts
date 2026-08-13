import type { Prisma, Store } from "@prisma/client";
import { ConflictError, NotFoundError } from "@/server/core/errors";
import { createLogger } from "@/server/core/logger";
import { providerRegistry } from "@/server/providers/registry";
import { storeRepository, type StoreFilter } from "@/server/repositories/store.repository";

const log = createLogger("services.store");

/**
 * Serviço de lojas.
 *
 * Ainda sem regra de negócio de varredura — o que existe aqui é o que a
 * infraestrutura precisa: CRUD, checagem de saúde do conector e a verificação
 * de que a `connectorKey` de uma loja corresponde a um provider registrado.
 * Uma loja apontando para um conector inexistente é uma falha que deve
 * aparecer no cadastro, não no primeiro ciclo às 3h da manhã.
 */
export class StoreService {
  list(filter: StoreFilter = {}) {
    return storeRepository.findMany(filter);
  }

  async getById(id: string): Promise<Store> {
    const store = await storeRepository.findById(id);
    if (!store) throw new NotFoundError("Loja", id);
    return store;
  }

  async getBySlug(slug: string): Promise<Store> {
    const store = await storeRepository.findBySlug(slug);
    if (!store) throw new NotFoundError("Loja", slug);
    return store;
  }

  async create(input: {
    slug: string;
    name: string;
    connectorKey: string;
    integrationType?: Store["integrationType"];
    accentColor?: string;
    priority?: number;
  }) {
    const existing = await storeRepository.findBySlug(input.slug);
    if (existing) throw new ConflictError(`Já existe loja com slug "${input.slug}"`);

    if (!providerRegistry.has(input.connectorKey)) {
      log.warn("Loja criada com conector ainda não registrado", {
        slug: input.slug,
        connectorKey: input.connectorKey,
      });
    }

    const store = await storeRepository.create({
      slug: input.slug,
      name: input.name,
      connectorKey: input.connectorKey,
      integrationType: input.integrationType ?? "SCRAPER",
      accentColor: input.accentColor,
      priority: input.priority ?? 100,
    });

    log.success("Loja criada", { id: store.id, slug: store.slug });
    return store;
  }

  async update(id: string, data: Prisma.StoreUpdateInput) {
    await this.getById(id);
    const store = await storeRepository.update(id, data);
    log.info("Loja atualizada", { id, campos: Object.keys(data) });
    return store;
  }

  async remove(id: string) {
    await this.getById(id);
    const store = await storeRepository.softDelete(id);
    log.info("Loja desativada (soft delete)", { id });
    return store;
  }

  /**
   * Executa o `healthCheck` do conector e persiste o resultado.
   * Faz as duas coisas de propósito: a Central lê `healthStatus` da tabela,
   * então checar sem gravar deixaria a interface mentindo.
   */
  async checkConnector(id: string) {
    const store = await this.getById(id);
    const connector = providerRegistry.tryGet(store.connectorKey);

    if (!connector) {
      await storeRepository.update(id, {
        healthStatus: "UNKNOWN",
        status: "PAUSED",
      });
      return {
        healthy: false,
        message: `Conector "${store.connectorKey}" não está registrado`,
        latencyMs: 0,
      };
    }

    try {
      const report = await connector.healthCheck({
        storeId: store.id,
        storeSlug: store.slug,
        credentials: {},
        config: (store.config as Record<string, unknown>) ?? {},
      });

      await storeRepository.update(id, {
        healthStatus: report.healthy ? "HEALTHY" : "FAILING",
        avgLatencyMs: report.latencyMs,
        ...(report.healthy
          ? { lastSuccessAt: new Date(), consecutiveFailures: 0 }
          : { consecutiveFailures: { increment: 1 } }),
      });

      return report;
    } catch (e) {
      await storeRepository.update(id, {
        healthStatus: "FAILING",
        consecutiveFailures: { increment: 1 },
      });
      throw e;
    }
  }

  /** Panorama para a Central de Operações. */
  async overview() {
    const [byStatus, page, registered] = await Promise.all([
      storeRepository.countByStatus(),
      storeRepository.findMany({ limit: 0 }),
      Promise.resolve(providerRegistry.describe()),
    ]);

    return {
      total: page.total,
      byStatus: Object.fromEntries(byStatus.map((r) => [r.status, r._count._all])),
      connectorsRegistrados: registered.length,
    };
  }
}

export const storeService = new StoreService();
