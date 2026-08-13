import type { Prisma, PriceObservation, PriceStatistic } from "@prisma/client";
import { db } from "@/server/db";
import { BaseRepository, type DbClient } from "./base.repository";

/**
 * Repositório de precificação.
 *
 * Duas responsabilidades:
 * 1. Append de PriceObservation — registra o preço de um produto num instante.
 * 2. PriceStatistic — rollup recalculado periodicamente com mediana, p25, etc.
 *
 * PriceObservation é append-only: nunca sofre UPDATE ou DELETE. É a tabela de
 * maior volume do sistema e candidata a particionamento mensal no futuro.
 */

export interface RecordObservationInput {
  productId: string;
  storeId: string;
  executionId?: string;
  price: number;
  listPrice?: number;
  shippingCost?: number;
  currency?: string;
  availability?: "IN_STOCK" | "LOW_STOCK" | "OUT_OF_STOCK" | "PREORDER" | "UNKNOWN";
  inStock?: boolean;
  source?: "SCHEDULED_SCAN" | "OFFER_DETECTION" | "MANUAL_CHECK" | "WEBHOOK" | "BACKFILL";
}

export class PricingRepository extends BaseRepository {
  withTransaction(tx: Prisma.TransactionClient) {
    return new PricingRepository(tx);
  }

  /** Grava uma observação de preço. Append-only. */
  async recordObservation(input: RecordObservationInput): Promise<PriceObservation> {
    return this.client.priceObservation.create({
      data: {
        productId: input.productId,
        storeId: input.storeId,
        executionId: input.executionId,
        price: input.price,
        listPrice: input.listPrice,
        shippingCost: input.shippingCost,
        currency: input.currency ?? "BRL",
        availability: input.availability ?? "UNKNOWN",
        inStock: input.inStock ?? true,
        source: input.source ?? "SCHEDULED_SCAN",
      },
    });
  }

  /** Grava observações em lote — uma por produto. */
  async recordObservationsBatch(inputs: RecordObservationInput[]) {
    if (inputs.length === 0) return 0;

    const { count } = await this.client.priceObservation.createMany({
      data: inputs.map((input) => ({
        productId: input.productId,
        storeId: input.storeId,
        executionId: input.executionId,
        price: input.price,
        listPrice: input.listPrice,
        shippingCost: input.shippingCost,
        currency: input.currency ?? "BRL",
        availability: input.availability ?? "UNKNOWN",
        inStock: input.inStock ?? true,
        source: input.source ?? "SCHEDULED_SCAN",
      })),
    });

    return count;
  }

  /** Última observação de preço de um produto. */
  async findLatest(productId: string): Promise<PriceObservation | null> {
    return this.client.priceObservation.findFirst({
      where: { productId },
      orderBy: { observedAt: "desc" },
    });
  }

  /** Histórico de preço de um produto, paginado. */
  async findHistory(productId: string, limit = 100, since?: Date) {
    return this.client.priceObservation.findMany({
      where: {
        productId,
        ...(since ? { observedAt: { gte: since } } : {}),
      },
      orderBy: { observedAt: "desc" },
      take: limit,
    });
  }

  /**
   * Upsert de PriceStatistic — recalcula rollup para uma janela.
   *
   * Em produção o rollup ideal seria feito via SQL puro com funções de
   * percentil (percentile_cont). Aqui usamos Prisma com cálculo em memória
   * para manter o repositório testável sem SQL cru.
   */
  async computeStatistic(
    productId: string,
    windowDays: number,
  ): Promise<PriceStatistic | null> {
    const since = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000);

    const observations = await this.client.priceObservation.findMany({
      where: { productId, observedAt: { gte: since } },
      orderBy: { price: "asc" },
      select: { price: true, observedAt: true },
    });

    if (observations.length === 0) return null;

    const prices = observations.map((o) => Number(o.price));
    const sorted = [...prices].sort((a, b) => a - b);
    const n = sorted.length;

    const min = sorted[0];
    const max = sorted[n - 1];
    const avg = prices.reduce((sum, p) => sum + p, 0) / n;
    const median = n % 2 === 1 ? sorted[Math.floor(n / 2)] : (sorted[n / 2 - 1] + sorted[n / 2]) / 2;
    const p25 = sorted[Math.floor(n * 0.25)];

    const variance = prices.reduce((sum, p) => sum + (p - avg) ** 2, 0) / n;
    const stdDev = Math.sqrt(variance);

    // Data do preço mínimo
    const minObs = observations.find((o) => Number(o.price) === min);

    return this.client.priceStatistic.upsert({
      where: { productId_windowDays: { productId, windowDays } },
      create: {
        productId,
        windowDays,
        minPrice: min,
        maxPrice: max,
        avgPrice: avg,
        medianPrice: median,
        p25Price: p25,
        stdDeviation: stdDev,
        sampleCount: n,
        minPriceAt: minObs?.observedAt,
      },
      update: {
        minPrice: min,
        maxPrice: max,
        avgPrice: avg,
        medianPrice: median,
        p25Price: p25,
        stdDeviation: stdDev,
        sampleCount: n,
        minPriceAt: minObs?.observedAt,
        computedAt: new Date(),
      },
    });
  }

  /** Busca a estatística atual de um produto. */
  findStatistic(productId: string, windowDays = 90) {
    return this.client.priceStatistic.findUnique({
      where: { productId_windowDays: { productId, windowDays } },
    });
  }

  /** Conta total de observações (para monitorar crescimento). */
  countObservations(storeId?: string) {
    return this.client.priceObservation.count({
      where: storeId ? { storeId } : {},
    });
  }
}

export const pricingRepository = new PricingRepository(db as DbClient);
