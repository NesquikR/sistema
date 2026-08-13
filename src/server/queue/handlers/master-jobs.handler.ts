import { createLogger } from "@/server/core/logger";
import { storeRepository } from "@/server/repositories/store.repository";
import { offerRepository } from "@/server/repositories/offer.repository";
import { pricingService } from "@/server/services/pricing.service";
import { aiService } from "@/server/services/ai.service";
import { telegramService } from "@/server/services/telegram.service";
import { queueService } from "@/server/queue/queue.service";
import { providerRegistry } from "@/server/providers/registry";
import { connectorService } from "@/server/services/connector.service";
import { normalizeError } from "@/server/core/errors";
import type { HandlerDefinition, JobContext } from "@/server/queue/types";

const log = createLogger("handler.master-jobs");

/**
 * Handler mestre de Sincronização de Lojas.
 *
 * Disparado pelo agendador. Localiza todas as lojas ativas
 * e enfileira um job de sincronização específico para cada uma delas.
 */
export const syncStoresMasterHandler: HandlerDefinition = {
  name: "connectors.sync-stores-master",
  queue: "connectors",
  timeoutMs: 60_000,
  async handler(_payload, ctx: JobContext) {
    const storesResult = await storeRepository.findMany({ isActive: true, status: "ACTIVE" });
    const stores = storesResult.items;

    log.info("Disparando sincronização mestre de lojas", { total: stores.length });

    let enqueuedCount = 0;
    for (const store of stores) {
      await queueService.enqueueOnce(
        "connectors.sync-store",
        { storeId: store.id, trigger: "CRON" },
        `sync-${store.id}-${new Date().toISOString().slice(0, 13)}`, // Deduplica por hora
      );
      enqueuedCount++;
    }

    return {
      message: `Enfileirados ${enqueuedCount} jobs de sincronização de loja`,
      data: { enqueued: enqueuedCount },
    };
  },
};

/**
 * Handler de Avaliação em Lote pela IA.
 *
 * Busca ofertas em estado DETECTED/VALIDATED e enfileira a avaliação
 * individual de cada uma delas.
 */
export const aiEvaluateBatchHandler: HandlerDefinition = {
  name: "ai.evaluate-batch",
  queue: "analysis",
  timeoutMs: 120_000,
  async handler(_payload, _ctx: JobContext) {
    const pendingOffers = await offerRepository.findPendingAnalysis(50);
    log.info("Processando lote de avaliação de IA", { total: pendingOffers.length });

    let enqueuedCount = 0;
    for (const offer of pendingOffers) {
      await queueService.enqueueOnce(
        "ai.evaluate-offer",
        { offerId: offer.id },
        `ai-eval-${offer.id}`,
      );
      enqueuedCount++;
    }

    return {
      message: `Enfileirados ${enqueuedCount} jobs de avaliação de ofertas`,
      data: { enqueued: enqueuedCount },
    };
  },
};

/**
 * Handler da Fila de Publicação.
 *
 * Busca ofertas APPROVED prontas para publicação e tenta publicá-las.
 */
export const publishQueueHandler: HandlerDefinition = {
  name: "publishing.process-queue",
  queue: "publishing",
  timeoutMs: 120_000,
  async handler(_payload, _ctx: JobContext) {
    const readyOffers = await offerRepository.findReadyToPublish(10);
    log.info("Processando fila de publicação", { total: readyOffers.length });

    let publishedCount = 0;
    let failedCount = 0;

    for (const offer of readyOffers) {
      try {
        const result = await telegramService.publishOffer(offer.id);
        if (result.success) {
          publishedCount++;
        } else {
          failedCount++;
        }
      } catch (e) {
        log.warn("Erro ao publicar oferta na fila mestre", { offerId: offer.id, error: e });
        failedCount++;
      }
    }

    return {
      message: `Processamento de publicação concluído: ${publishedCount} enviadas, ${failedCount} falhas/adiadas`,
      data: { published: publishedCount, failed: failedCount },
    };
  },
};

/**
 * Handler de Recálculo de Estatísticas de Preço.
 *
 * Recalcula as médias, medianas e percentis históricos de preço de todas as lojas.
 */
export const priceStatsHandler: HandlerDefinition = {
  name: "pricing.recompute-all",
  queue: "maintenance",
  timeoutMs: 1800_000, // 30 min
  async handler(_payload, _ctx: JobContext) {
    const storesResult = await storeRepository.findMany({ isActive: true });
    const stores = storesResult.items;

    log.info("Iniciando recálculo diário de estatísticas de preço", { lojas: stores.length });

    let totalComputed = 0;
    for (const store of stores) {
      const count = await pricingService.recomputeAll(store.id);
      totalComputed += count;
    }

    return {
      message: `Estatísticas recomputadas para ${totalComputed} produtos em ${stores.length} lojas`,
      data: { totalComputed, storesCount: stores.length },
    };
  },
};

/**
 * Handler de Diagnóstico e Saúde das Lojas (Health Check).
 *
 * Executa o health check contra cada provedor ativo para atualizar a saúde dele.
 */
export const healthCheckAllHandler: HandlerDefinition = {
  name: "health.check-all",
  queue: "maintenance",
  timeoutMs: 120_000,
  async handler(_payload, ctx: JobContext) {
    const storesResult = await storeRepository.findMany({ isActive: true });
    const stores = storesResult.items;

    log.info("Executando health check geral de conectores", { lojas: stores.length });

    let healthyCount = 0;
    let failingCount = 0;

    for (const store of stores) {
      try {
        if (!providerRegistry.has(store.connectorKey)) {
          throw new Error(`Conector ${store.connectorKey} não registrado`);
        }
        const connector = providerRegistry.get(store.connectorKey);
        const connectorCtx = await connectorService.buildContext(store);
        const report = await connector.healthCheck(connectorCtx);

        await storeRepository.update(store.id, {
          healthStatus: report.healthy ? "HEALTHY" : "FAILING",
          consecutiveFailures: report.healthy ? 0 : { increment: 1 },
          metadata: {
            ...(store.metadata as Record<string, unknown> || {}),
            lastHealthCheckAt: new Date().toISOString(),
            latencyMs: report.latencyMs,
            details: report.message,
          },
        });

        if (report.healthy) healthyCount++;
        else failingCount++;
      } catch (e) {
        log.warn("Erro no health check da loja", { storeId: store.id, error: e });
        await storeRepository.update(store.id, {
          healthStatus: "FAILING",
          consecutiveFailures: { increment: 1 },
        });
        failingCount++;
      }
    }

    return {
      message: `Health check geral concluído: ${healthyCount} saudáveis, ${failingCount} com problemas`,
      data: { healthy: healthyCount, failing: failingCount },
    };
  },
};

/**
 * Handler de Verificação de Cupons (Stub/Placeholder).
 */
export const couponVerifyAllHandler: HandlerDefinition = {
  name: "coupons.verify-all",
  queue: "maintenance",
  timeoutMs: 300_000,
  async handler(_payload, _ctx: JobContext) {
    log.info("Verificando cupons ativos (noop)");
    return { message: "Verificação de cupons concluída (noop)" };
  },
};

/**
 * Handler de Consolidação de Analytics (Stub/Placeholder).
 */
export const analyticsRollupAllHandler: HandlerDefinition = {
  name: "analytics.rollup-all",
  queue: "maintenance",
  timeoutMs: 600_000,
  async handler(_payload, _ctx: JobContext) {
    log.info("Consolidando analytics (noop)");
    return { message: "Consolidação de analytics concluída (noop)" };
  },
};
