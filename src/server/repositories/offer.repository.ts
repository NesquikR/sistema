import type { Prisma, Offer, OfferStatus } from "@prisma/client";
import { db } from "@/server/db";
import { BaseRepository, toPage, type DbClient, type Page } from "./base.repository";

/**
 * Repositório de ofertas.
 *
 * A oferta é o conceito central do sistema: um fato histórico que diz "este
 * produto, a este preço, neste momento, merece ser contado a alguém". Uma vez
 * criada, os campos de snapshot (title, price, previousPrice) são imutáveis —
 * o que muda é o status.
 *
 * O `dedupeKey` (sha256 de productId|preço|dia) garante que a mesma promoção
 * não aparece duas vezes no mesmo dia, mesmo sob execuções concorrentes.
 */

export interface OfferFilter {
  status?: OfferStatus | OfferStatus[];
  storeId?: string;
  categoryId?: string;
  brandId?: string;
  minScore?: number;
  search?: string;
  limit?: number;
  offset?: number;
}

export interface CreateOfferInput {
  productId: string;
  storeId: string;
  categoryId?: string;
  brandId?: string;
  couponId?: string;
  executionId?: string;
  title: string;
  imageUrl?: string;
  price: number;
  previousPrice: number;
  referencePrice?: number;
  lowestEverPrice?: number;
  discountPercent: number;
  discountAmount: number;
  belowAveragePct?: number;
  currency?: string;
  freeShipping?: boolean;
  shippingCost?: number;
  availability?: "IN_STOCK" | "LOW_STOCK" | "OUT_OF_STOCK" | "PREORDER" | "UNKNOWN";
  stockEstimate?: number;
  rating?: number;
  reviewCount?: number;
  dedupeKey: string;
  metadata?: Prisma.InputJsonValue;
}

export class OfferRepository extends BaseRepository {
  withTransaction(tx: Prisma.TransactionClient) {
    return new OfferRepository(tx);
  }

  async findMany(filter: OfferFilter = {}): Promise<Page<Offer>> {
    const { limit = 50, offset = 0 } = filter;

    const statusFilter = filter.status
      ? Array.isArray(filter.status)
        ? { in: filter.status }
        : filter.status
      : undefined;

    const where: Prisma.OfferWhereInput = {
      ...(statusFilter ? { status: statusFilter } : {}),
      ...(filter.storeId ? { storeId: filter.storeId } : {}),
      ...(filter.categoryId ? { categoryId: filter.categoryId } : {}),
      ...(filter.brandId ? { brandId: filter.brandId } : {}),
      ...(filter.minScore ? { score: { gte: filter.minScore } } : {}),
      ...(filter.search
        ? { title: { contains: filter.search, mode: "insensitive" as const } }
        : {}),
    };

    const [items, total] = await Promise.all([
      this.client.offer.findMany({
        where,
        orderBy: [{ detectedAt: "desc" }],
        include: {
          store: { select: { id: true, name: true, slug: true, accentColor: true } },
          category: { select: { id: true, name: true, emoji: true } },
          brand: { select: { id: true, name: true } },
          coupon: { select: { id: true, code: true, type: true, value: true } },
        },
        take: limit,
        skip: offset,
      }),
      this.client.offer.count({ where }),
    ]);

    return toPage(items, total, limit, offset);
  }

  findById(id: string) {
    return this.client.offer.findUnique({
      where: { id },
      include: {
        store: true,
        product: { include: { images: { where: { isPrimary: true }, take: 1 } } },
        category: true,
        brand: true,
        coupon: true,
        aiAnalyses: { orderBy: { createdAt: "desc" }, take: 3 },
        messages: { orderBy: { createdAt: "desc" }, take: 1 },
        statusEvents: { orderBy: { createdAt: "desc" }, take: 10 },
      },
    });
  }

  /** Verifica se já existe oferta para o mesmo produto/preço/dia. */
  findByDedupeKey(dedupeKey: string) {
    return this.client.offer.findUnique({ where: { dedupeKey } });
  }

  async create(input: CreateOfferInput): Promise<Offer> {
    const offer = await this.client.offer.create({
      data: {
        productId: input.productId,
        storeId: input.storeId,
        categoryId: input.categoryId,
        brandId: input.brandId,
        couponId: input.couponId,
        executionId: input.executionId,
        title: input.title,
        imageUrl: input.imageUrl,
        price: input.price,
        previousPrice: input.previousPrice,
        referencePrice: input.referencePrice,
        lowestEverPrice: input.lowestEverPrice,
        discountPercent: input.discountPercent,
        discountAmount: input.discountAmount,
        belowAveragePct: input.belowAveragePct,
        currency: input.currency ?? "BRL",
        freeShipping: input.freeShipping ?? false,
        shippingCost: input.shippingCost,
        availability: input.availability ?? "UNKNOWN",
        stockEstimate: input.stockEstimate,
        rating: input.rating,
        reviewCount: input.reviewCount,
        dedupeKey: input.dedupeKey,
        status: "DETECTED",
        metadata: input.metadata ?? undefined,
      },
    });

    // Evento de status: DETECTED é o primeiro
    await this.client.offerStatusEvent.create({
      data: {
        offerId: offer.id,
        toStatus: "DETECTED",
        actorType: "SYSTEM",
        reason: "Oferta detectada automaticamente",
      },
    });

    return offer;
  }

  /**
   * Transição de status atômica com registro de evento.
   *
   * O padrão state machine: toda transição grava o de→para em
   * OfferStatusEvent. Isso dá rastreabilidade completa e permite calcular
   * métricas como "tempo médio entre detecção e publicação".
   */
  async transition(
    id: string,
    toStatus: OfferStatus,
    opts: {
      actorType?: "SYSTEM" | "AI" | "USER" | "CONNECTOR";
      actorId?: string;
      reason?: string;
      metadata?: Prisma.InputJsonValue;
      score?: number;
      decisionSource?: "RULE_ENGINE" | "AI" | "MANUAL" | "AUTO_THRESHOLD";
      rejectionReason?: string;
      rejectionNote?: string;
      affiliateLinkId?: string;
    } = {},
  ): Promise<Offer> {
    const current = await this.client.offer.findUniqueOrThrow({ where: { id } });

    const now = new Date();
    const timestampFields: Prisma.OfferUpdateInput = {};

    switch (toStatus) {
      case "VALIDATED": timestampFields.validatedAt = now; break;
      case "APPROVED": timestampFields.approvedAt = now; break;
      case "PUBLISHED": timestampFields.publishedAt = now; break;
      case "REJECTED": timestampFields.rejectedAt = now; break;
      case "SCHEDULED": timestampFields.scheduledFor = now; break;
    }

    const updated = await this.client.offer.update({
      where: { id },
      data: {
        status: toStatus,
        ...timestampFields,
        ...(opts.score !== undefined ? { score: opts.score } : {}),
        ...(opts.decisionSource ? { decisionSource: opts.decisionSource } : {}),
        ...(opts.rejectionReason ? { rejectionReason: opts.rejectionReason as never } : {}),
        ...(opts.rejectionNote ? { rejectionNote: opts.rejectionNote } : {}),
        ...(opts.affiliateLinkId ? { affiliateLink: { connect: { id: opts.affiliateLinkId } } } : {}),
      },
    });

    await this.client.offerStatusEvent.create({
      data: {
        offerId: id,
        fromStatus: current.status,
        toStatus,
        actorType: opts.actorType ?? "SYSTEM",
        actorId: opts.actorId,
        reason: opts.reason,
        metadata: opts.metadata ?? undefined,
      },
    });

    return updated;
  }

  /** Ofertas pendentes de análise da IA. */
  findPendingAnalysis(limit = 20) {
    return this.client.offer.findMany({
      where: { status: { in: ["DETECTED", "VALIDATED"] } },
      orderBy: [{ discountPercent: "desc" }, { detectedAt: "asc" }],
      take: limit,
    });
  }

  /** Ofertas aguardando decisão humana. */
  findPendingReview(limit = 20) {
    return this.client.offer.findMany({
      where: { status: "PENDING_REVIEW" },
      orderBy: [{ score: "desc" }, { detectedAt: "asc" }],
      include: {
        store: { select: { name: true, slug: true, accentColor: true } },
        category: { select: { name: true, emoji: true } },
        aiAnalyses: { orderBy: { createdAt: "desc" }, take: 1 },
      },
      take: limit,
    });
  }

  /** Ofertas aprovadas prontas para publicação. */
  findReadyToPublish(limit = 10) {
    return this.client.offer.findMany({
      where: { status: "APPROVED" },
      orderBy: [{ score: "desc" }, { approvedAt: "asc" }],
      include: {
        store: true,
        product: true,
        category: true,
        coupon: true,
      },
      take: limit,
    });
  }

  /** Contadores por status — alimenta o funil do dashboard. */
  async countByStatus() {
    return this.client.offer.groupBy({
      by: ["status"],
      _count: { _all: true },
    });
  }

  /** Ofertas criadas nas últimas N horas. */
  async countRecent(hoursAgo = 24) {
    const since = new Date(Date.now() - hoursAgo * 60 * 60 * 1000);
    return this.client.offer.count({
      where: { detectedAt: { gte: since } },
    });
  }

  async setAffiliateLink(id: string, affiliateLinkId: string) {
    return this.client.offer.update({
      where: { id },
      data: { affiliateLink: { connect: { id: affiliateLinkId } } },
    });
  }
}

export const offerRepository = new OfferRepository(db as DbClient);
