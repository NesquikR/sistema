import { createLogger } from "@/server/core/logger";
import { NotFoundError } from "@/server/core/errors";
import type { AiProvider } from "./types";

const log = createLogger("ai.registry");

/**
 * Registro de provedores de IA.
 *
 * Mesma mecânica do providerRegistry de lojas: sobrevive ao hot reload,
 * é idempotente e o service sempre fala com o registro, nunca com
 * um provider concreto.
 */
class AiProviderRegistry {
  private readonly providers = new Map<string, AiProvider>();

  register(provider: AiProvider) {
    if (this.providers.has(provider.key)) {
      log.warn("AI provider sobrescrito", { key: provider.key });
    }
    this.providers.set(provider.key, provider);
    log.debug("AI provider registrado", { key: provider.key, name: provider.name });
  }

  get(key: string): AiProvider {
    const found = this.providers.get(key);
    if (!found) throw new NotFoundError("AI provider", key);
    return found;
  }

  has(key: string) {
    return this.providers.has(key);
  }

  get size() {
    return this.providers.size;
  }

  list() {
    return [...this.providers.values()].map((p) => ({
      key: p.key,
      name: p.name,
    }));
  }

  /** Devolve o primeiro provider disponível. */
  getDefault(): AiProvider | null {
    const first = this.providers.values().next();
    return first.done ? null : first.value;
  }
}

const globalForAi = globalThis as unknown as {
  __beautybotAiRegistry?: AiProviderRegistry;
};

export const aiProviderRegistry =
  globalForAi.__beautybotAiRegistry ?? new AiProviderRegistry();

globalForAi.__beautybotAiRegistry = aiProviderRegistry;
