import { createLogger } from "@/server/core/logger";
import { pricingRepository, type RecordObservationInput } from "@/server/repositories/pricing.repository";
import { productRepository } from "@/server/repositories/product.repository";
import type { Product } from "@prisma/client";

const log = createLogger("pricing.service");

/**
 * Serviço de precificação.
 *
 * Duas responsabilidades:
 * 1. Gravar observações de preço a cada varredura
 * 2. Recalcular estatísticas (mediana, p25, etc.) periodicamente
 *
 * O preço mediano (não a média) é a referência para validar se um desconto é
 * real. A mediana resiste a outliers — e outlier é exatamente do que a promoção
 * falsa é feita.
 */

/** Janelas de cálculo de estatísticas (em dias). */
const STAT_WINDOWS = [7, 30, 90];

export class PricingService {
  /**
   * Grava observações de preço para um lote de produtos.
   *
   * Chamado pelo handler de sync após o upsert dos produtos. O executionId
   * liga cada observação à execução que a produziu — útil para diagnóstico.
   */
  async recordBatch(
    products: Product[],
    storeId: string,
    executionId?: string,
  ): Promise<number> {
    const observations: RecordObservationInput[] = [];

    for (const product of products) {
      if (product.currentPrice == null) continue;

      observations.push({
        productId: product.id,
        storeId,
        executionId,
        price: Number(product.currentPrice),
        listPrice: product.listPrice ? Number(product.listPrice) : undefined,
        currency: product.currency,
        availability: product.availability as RecordObservationInput["availability"],
        inStock: product.availability === "IN_STOCK" || product.availability === "LOW_STOCK",
        source: "SCHEDULED_SCAN",
      });
    }

    if (observations.length === 0) return 0;

    const count = await pricingRepository.recordObservationsBatch(observations);
    log.debug("Observações de preço gravadas", { storeId, count });
    return count;
  }

  /**
   * Recalcula estatísticas de preço para um produto.
   *
   * Chamado periodicamente (job PRICE_STATS) e pontualmente quando uma
   * oferta precisa de referência de preço para validação.
   */
  async computeStats(productId: string) {
    const results = [];
    for (const windowDays of STAT_WINDOWS) {
      const stat = await pricingRepository.computeStatistic(productId, windowDays);
      if (stat) results.push(stat);
    }
    return results;
  }

  /**
   * Obtém o preço de referência para validação de desconto.
   *
   * A lógica: desconto real é calculado contra a mediana dos últimos 90 dias,
   * não contra o listPrice (que lojas inflam para fabricar desconto).
   * Se não houver histórico suficiente, cai para 30 dias, depois 7.
   */
  async getReferencePrice(productId: string): Promise<{
    referencePrice: number | null;
    lowestEver: number | null;
    windowDays: number;
    sampleCount: number;
  }> {
    for (const windowDays of [90, 30, 7]) {
      const stat = await pricingRepository.findStatistic(productId, windowDays);
      if (stat && stat.sampleCount >= 3) {
        return {
          referencePrice: Number(stat.medianPrice),
          lowestEver: Number(stat.minPrice),
          windowDays,
          sampleCount: stat.sampleCount,
        };
      }
    }

    // Sem histórico: tenta a última observação como fallback
    const latest = await pricingRepository.findLatest(productId);
    if (latest) {
      return {
        referencePrice: Number(latest.listPrice ?? latest.price),
        lowestEver: Number(latest.price),
        windowDays: 0,
        sampleCount: 1,
      };
    }

    return { referencePrice: null, lowestEver: null, windowDays: 0, sampleCount: 0 };
  }

  /**
   * Recalcula estatísticas para todos os produtos de uma loja.
   *
   * Usado pelo job PRICE_STATS que roda diariamente às 3h.
   */
  async recomputeAll(storeId: string, limit = 5000): Promise<number> {
    // Busca produtos ativos com observações
    const productIds = await productRepository.findActiveProductIdsForStore(storeId, limit);

    let computed = 0;
    for (const productId of productIds) {
      try {
        await this.computeStats(productId);
        computed++;
      } catch (e) {
        log.warn("Falha ao recomputar estatísticas", {
          productId,
          error: e,
        });
      }
    }

    log.info("Estatísticas de preço recomputadas", {
      storeId,
      total: productIds.length,
      computed,
    });

    return computed;
  }
}

export const pricingService = new PricingService();
