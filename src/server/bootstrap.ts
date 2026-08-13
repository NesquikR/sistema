import { loadEnv } from "@/server/config/env";
import { createLogger } from "@/server/core/logger";
import { normalizeError } from "@/server/core/errors";
import { disconnectDatabase, pingDatabase } from "@/server/db";
import { providerRegistry } from "@/server/providers/registry";
import { mockProvider } from "@/server/providers/mock/mock.provider";
import { mercadoLivreProvider } from "@/server/providers/mercadolivre/mercadolivre.provider";
import { shopeeProvider } from "@/server/providers/shopee/shopee.provider";
import {
  handlerRegistry,
  failingHandler,
  noopHandler,
  syncStoreHandler,
  evaluateOfferHandler,
  publishOfferHandler,
  syncStoresMasterHandler,
  aiEvaluateBatchHandler,
  publishQueueHandler,
  priceStatsHandler,
  healthCheckAllHandler,
  couponVerifyAllHandler,
  analyticsRollupAllHandler,
} from "@/server/queue/handlers";
import { logService } from "@/server/services/log.service";
import { aiProviderRegistry } from "@/server/providers/ai/registry";
import { mockAiProvider } from "@/server/providers/ai/mock/mock-ai.provider";
import { mockTelegramProvider } from "@/server/providers/telegram/mock/mock-telegram.provider";
import { setTelegramProvider } from "@/server/services/telegram.service";

const log = createLogger("bootstrap");

/**
 * Inicialização da aplicação.
 *
 * Roda uma única vez por processo e é **idempotente**: o hot reload do Next.js
 * reavalia módulos constantemente, e sem essa guarda os conectores seriam
 * registrados dezenas de vezes por sessão de desenvolvimento.
 *
 * Ordem deliberada:
 *   1. `env` primeiro — configuração inválida derruba o processo aqui, e não
 *      na primeira requisição;
 *   2. logger persistente em seguida, para que o resto do boot já seja
 *      registrado;
 *   3. registros (providers, handlers) por último, pois só dependem de código.
 *
 * O banco **não** é obrigatório para inicializar: a aplicação sobe, reporta o
 * estado no health check e continua tentando. Recusar-se a iniciar porque o
 * Postgres ainda não está de pé é o que transforma uma indisponibilidade curta
 * numa manual.
 */

export interface RuntimeInfo {
  initialized: boolean;
  startedAt: Date | null;
  databaseReachable: boolean;
  mode: "web" | "worker" | "cli";
}

const globalForRuntime = globalThis as unknown as {
  __beautybotRuntime?: RuntimeInfo;
  __beautybotBootPromise?: Promise<RuntimeInfo>;
};

const runtime: RuntimeInfo = globalForRuntime.__beautybotRuntime ?? {
  initialized: false,
  startedAt: null,
  databaseReachable: false,
  mode: "web",
};
globalForRuntime.__beautybotRuntime = runtime;

export function getRuntimeInfo(): RuntimeInfo {
  return runtime;
}

export function bootstrap(mode: RuntimeInfo["mode"] = "web"): Promise<RuntimeInfo> {
  if (globalForRuntime.__beautybotBootPromise) {
    // Rede de segurança: se por qualquer motivo os registros ficarem vazios
    // (hot reload, módulo reavaliado), repovoa antes de devolver o cache.
    // Um bootstrap "concluído" com registro vazio é pior que não inicializado,
    // porque nada denuncia o problema até a primeira execução falhar.
    ensureRegistrations();
    return globalForRuntime.__beautybotBootPromise;
  }

  const promise = (async () => {
    const env = loadEnv();
    runtime.mode = mode;
    runtime.startedAt = new Date();

    // 1. Persistência de logs
    if (env.LOG_PERSIST) logService.attach();

    log.info("Inicializando BeautyBot", {
      modo: mode,
      ambiente: env.NODE_ENV,
      timezone: env.APP_TIMEZONE,
      node: process.version,
    });

    // 2. Banco (não bloqueante)
    try {
      const latencyMs = await pingDatabase();
      runtime.databaseReachable = true;
      log.success("PostgreSQL conectado", { latencyMs });
    } catch (e) {
      runtime.databaseReachable = false;
      log.error(
        "PostgreSQL inacessível — a aplicação segue de pé e o health check reportará o estado",
        { error: normalizeError(e), skipPersist: true },
      );
    }

    // 3 e 4. Conectores e handlers de fila
    ensureRegistrations();

    runtime.initialized = true;
    log.success("BeautyBot pronto", {
      conectores: providerRegistry.size,
      handlers: handlerRegistry.list().length,
      banco: runtime.databaseReachable ? "conectado" : "indisponível",
    });

    return runtime;
  })();

  globalForRuntime.__beautybotBootPromise = promise;
  return promise;
}

/**
 * Registro explícito de conectores e handlers.
 *
 * É o único ponto a tocar ao implementar uma loja nova. Idempotente: só
 * registra o que ainda não está registrado, então pode ser chamada quantas
 * vezes for preciso.
 */
export function ensureRegistrations() {
  for (const provider of [mockProvider, mercadoLivreProvider, shopeeProvider]) {
    if (!providerRegistry.has(provider.key)) providerRegistry.register(provider);
  }

  // Registra provedores de IA
  if (!aiProviderRegistry.has(mockAiProvider.key)) {
    aiProviderRegistry.register(mockAiProvider);
  }

  // Registra provedor do Telegram
  setTelegramProvider(mockTelegramProvider);

  // Registra todos os handlers de fila
  const allHandlers = [
    noopHandler,
    failingHandler,
    syncStoreHandler,
    evaluateOfferHandler,
    publishOfferHandler,
    syncStoresMasterHandler,
    aiEvaluateBatchHandler,
    publishQueueHandler,
    priceStatsHandler,
    healthCheckAllHandler,
    couponVerifyAllHandler,
    analyticsRollupAllHandler,
  ];

  for (const handler of allHandlers) {
    if (!handlerRegistry.has(handler.name)) {
      handlerRegistry.register(handler as any);
    }
  }
}

/**
 * Encerramento gracioso: descarrega o buffer de logs e fecha o pool.
 * Sem o flush, os últimos segundos antes do shutdown — os mais úteis num
 * incidente — se perderiam.
 */
export async function shutdown(reason: string) {
  log.info("Encerrando", { motivo: reason });
  try {
    await logService.detach();
    await disconnectDatabase();
  } catch (e) {
    process.stderr.write(`[shutdown] ${String(e)}\n`);
  }
  runtime.initialized = false;
  globalForRuntime.__beautybotBootPromise = undefined;
}
