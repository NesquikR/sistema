import { createLogger } from "@/server/core/logger";
import { normalizeError, UpstreamError } from "@/server/core/errors";
import { storeRepository } from "@/server/repositories/store.repository";
import { categoryRepository } from "@/server/repositories/category.repository";
import { executionRepository } from "@/server/repositories/execution.repository";
import { providerRegistry } from "@/server/providers/registry";
import { connectorService } from "@/server/services/connector.service";
import { productService } from "@/server/services/product.service";
import { pricingService } from "@/server/services/pricing.service";
import { offerService } from "@/server/services/offer.service";
import type { HandlerDefinition, JobContext } from "@/server/queue/types";
import type { ConnectorContext, FetchOptions } from "@/server/providers/types";

const log = createLogger("handler.sync-store");

/**
 * Handler de sincronização de loja.
 *
 * O job mais importante do sistema. Executado pelo scheduler a cada 15 min
 * (ou manualmente). O fluxo:
 *
 *   1. Resolve o conector e monta o contexto
 *   2. Itera pelas páginas de produtos (streaming via AsyncIterable)
 *   3. Para cada página:
 *      a. Upsert dos produtos (com contentHash para evitar UPDATE desnecessário)
 *      b. Grava observações de preço
 *      c. Detecta ofertas (desconto real vs. histórico)
 *   4. Atualiza contadores da execução
 *   5. Atualiza saúde da loja
 *
 * O handler **não** executa a análise da IA nem a publicação — apenas detecta
 * e enfileira. Cada etapa posterior é um job independente, processável em
 * paralelo e com retry isolado.
 */

interface SyncStorePayload {
  schedulerJobId?: string;
  jobKey?: string;
  storeId?: string;
  trigger?: string;
  terms?: string[];
  maxPages?: number;
}

export const syncStoreHandler: HandlerDefinition<SyncStorePayload> = {
  name: "connectors.sync-store",
  queue: "connectors",
  timeoutMs: 600_000, // 10 min
  maxAttempts: 2,

  async handler(payload, ctx: JobContext) {
    const storeId = payload.storeId;
    if (!storeId) {
      log.warn("sync-store sem storeId — nada a fazer");
      return { message: "storeId ausente" };
    }

    const store = await storeRepository.findById(storeId);
    if (!store || !store.isActive) {
      log.info("Loja inativa ou inexistente", { storeId });
      return { message: "Loja inativa" };
    }

    // Resolver o conector
    if (!providerRegistry.has(store.connectorKey)) {
      log.warn("Conector não registrado", { connectorKey: store.connectorKey });
      return { message: `Conector ${store.connectorKey} não registrado` };
    }

    const connector = providerRegistry.get(store.connectorKey);

    // Criar execução
    const execution = await executionRepository.start({
      storeId,
      trigger: (payload.trigger as any) ?? "CRON",
      correlationId: ctx.correlationId,
    });

    // Montar contexto do conector
    let connectorCtx: ConnectorContext;
    try {
      connectorCtx = await connectorService.buildContext(store);
    } catch (e) {
      await executionRepository.finish(execution.id, "FAILED", { errorMessage: normalizeError(e).message });
      throw e;
    }

    // Montar resolver de categorias (cache em memória durante a execução)
    const categoryCache = new Map<string, string | undefined>();
    const categoryResolver = (externalCategoryId: string): string | undefined => {
      if (categoryCache.has(externalCategoryId)) {
        return categoryCache.get(externalCategoryId);
      }
      // Cache miss: retorna undefined por enquanto (async não é possível aqui)
      // O mapeamento real é resolvido no pré-carregamento abaixo
      return undefined;
    };

    // Pré-carregar mapeamentos de categorias
    try {
      const allCategories = await categoryRepository.findAllActive();
      const mappings = await categoryRepository.findStoreMappings(storeId);
      for (const mapping of mappings) {
        categoryCache.set(mapping.externalCategoryId, mapping.categoryId);
      }
      log.debug("Mapeamentos de categoria carregados", {
        storeId,
        mappings: mappings.length,
        categories: allCategories.length,
      });
    } catch (e) {
      log.warn("Falha ao carregar mapeamentos de categoria", { error: e });
    }

    const started = Date.now();
    let itemsScanned = 0;
    let itemsNew = 0;
    let itemsUpdated = 0;
    let itemsSkipped = 0;
    let offersCreated = 0;
    let errorCount = 0;

    try {
      const fetchOptions: FetchOptions = {
        terms: payload.terms,
        maxPages: payload.maxPages ?? 10,
        signal: ctx.signal,
      };

      // Iterar por páginas (streaming)
      for await (const page of connector.fetchProducts(connectorCtx, fetchOptions)) {
        if (ctx.signal.aborted) {
          log.info("Sincronização abortada por sinal", { storeId });
          break;
        }

        itemsScanned += page.products.length;

        // a. Upsert de produtos
        const { created, updated, skipped, products } = await productService.upsertBatch(
          page.products,
          storeId,
          { executionId: execution.id, categoryResolver },
        );
        itemsNew += created;
        itemsUpdated += updated;
        itemsSkipped += skipped;

        // b. Gravar observações de preço
        await pricingService.recordBatch(products, storeId, execution.id);

        // c. Detectar ofertas
        const detection = await offerService.detectOffers(products, {
          storeId,
          executionId: execution.id,
        });
        offersCreated += detection.offersCreated;

        log.debug("Página processada", {
          page: page.page,
          products: page.products.length,
          hasMore: page.hasMore,
          offersDetected: detection.offersCreated,
        });
      }

      // Concluir execução
      const durationMs = Date.now() - started;
      await executionRepository.finishWithDuration(execution.id, "SUCCESS", execution.startedAt, {
        itemsScanned,
        itemsNew,
        itemsUpdated,
        itemsSkipped,
        offersCreated,
        errorCount,
      });

      // Atualizar saúde da loja
      await storeRepository.update(storeId, {
        lastSyncAt: new Date(),
        lastSuccessAt: new Date(),
        healthStatus: "HEALTHY",
        consecutiveFailures: 0,
      });

      log.success("Sincronização concluída", {
        storeId,
        store: store.name,
        durationMs,
        itemsScanned,
        itemsNew,
        itemsUpdated,
        offersCreated,
      });

      return {
        message: `${store.name}: ${itemsScanned} produtos, ${offersCreated} ofertas`,
        data: { itemsScanned, itemsNew, itemsUpdated, itemsSkipped, offersCreated },
      };
    } catch (e) {
      const err = normalizeError(e);
      const durationMs = Date.now() - started;

      await executionRepository.finishWithDuration(execution.id, "FAILED", execution.startedAt, {
        errorMessage: err.message,
        itemsScanned,
        itemsNew,
        itemsUpdated,
        itemsSkipped,
        offersCreated,
        errorCount: errorCount + 1,
      });

      // Atualizar saúde da loja
      await storeRepository.update(storeId, {
        lastSyncAt: new Date(),
        healthStatus: (store.consecutiveFailures ?? 0) >= 3 ? "FAILING" : "DEGRADED",
        consecutiveFailures: { increment: 1 },
      });

      log.error("Sincronização falhou", {
        storeId,
        store: store.name,
        durationMs,
        parcial: { itemsScanned, offersCreated },
        error: err,
      });

      throw new UpstreamError(`Sincronização ${store.name} falhou: ${err.message}`, {
        cause: e,
      });
    }
  },
};
