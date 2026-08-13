import { NotFoundError } from "@/server/core/errors";
import { createLogger } from "@/server/core/logger";
import type { StoreConnector } from "./types";

const log = createLogger("providers.registry");

/**
 * Registro de conectores.
 *
 * O registro é preenchido explicitamente no bootstrap, e não por varredura
 * automática de diretório: um conector só entra em operação porque alguém
 * decidiu registrá-lo. Descoberta mágica de arquivos é conveniente até o dia
 * em que um arquivo pela metade começa a rodar em produção sozinho.
 */
class ProviderRegistry {
  private readonly connectors = new Map<string, StoreConnector>();

  register(connector: StoreConnector) {
    if (this.connectors.has(connector.key)) {
      log.warn("Conector sobrescrito no registro", { key: connector.key });
    }
    this.connectors.set(connector.key, connector);
    log.debug("Conector registrado", {
      key: connector.key,
      version: connector.version,
    });
  }

  has(key: string) {
    return this.connectors.has(key);
  }

  get(key: string): StoreConnector {
    const found = this.connectors.get(key);
    if (!found) throw new NotFoundError("Conector", key);
    return found;
  }

  tryGet(key: string): StoreConnector | undefined {
    return this.connectors.get(key);
  }

  list(): StoreConnector[] {
    return [...this.connectors.values()];
  }

  describe() {
    return this.list().map((c) => ({
      key: c.key,
      displayName: c.displayName,
      version: c.version,
      capabilities: c.capabilities,
    }));
  }

  clear() {
    this.connectors.clear();
  }

  get size() {
    return this.connectors.size;
  }
}

/**
 * O registro vive no `globalThis`, não apenas no módulo.
 *
 * O hot reload do Next.js reavalia este arquivo e criaria uma instância nova e
 * vazia — enquanto o bootstrap, cacheado em `globalThis`, não roda de novo e
 * portanto não repovoa nada. O resultado seria um registro vazio em pleno
 * funcionamento, com o catálogo afirmando que o conector existe e a execução
 * respondendo que não. Ancorar a instância no mesmo lugar do bootstrap elimina
 * a divergência.
 */
const globalForRegistry = globalThis as unknown as {
  __beautybotProviderRegistry?: ProviderRegistry;
};

export const providerRegistry =
  globalForRegistry.__beautybotProviderRegistry ?? new ProviderRegistry();

globalForRegistry.__beautybotProviderRegistry = providerRegistry;
