import type { NextRequest } from "next/server";
import { z } from "zod";
import { bootstrap } from "@/server/bootstrap";
import { parseQuery, withApiHandler } from "@/server/http/handler";
import { ok } from "@/server/http/responses";
import { offerRepository, type OfferFilter } from "@/server/repositories/offer.repository";
import type { OfferStatus } from "@prisma/client";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const statusMapping: Record<string, OfferStatus[]> = {
  fila: ["DETECTED", "VALIDATED", "PENDING_REVIEW"],
  aprovada: ["APPROVED"],
  agendada: ["SCHEDULED"],
  publicada: ["PUBLISHED"],
  ignorada: ["REJECTED", "FAILED"],
  expirada: ["EXPIRED"],
};

const querySchema = z.object({
  status: z.string().optional(),
  storeId: z.string().optional(),
  categoryId: z.string().optional(),
  search: z.string().optional(),
  limit: z.coerce.number().default(50),
  offset: z.coerce.number().default(0),
});

export const GET = withApiHandler(async (request: NextRequest) => {
  await bootstrap("web");
  const query = parseQuery(request, querySchema);

  let mappedStatus: OfferStatus[] | undefined;
  if (query.status && query.status !== "todos") {
    mappedStatus = statusMapping[query.status] || [query.status as OfferStatus];
  }

  const filter: OfferFilter = {
    status: mappedStatus,
    storeId: query.storeId !== "todas" ? query.storeId : undefined,
    categoryId: query.categoryId !== "todas" ? query.categoryId : undefined,
    search: query.search || undefined,
    limit: query.limit,
    offset: query.offset,
  };

  const page = await offerRepository.findMany(filter);

  // Mapeia os dados do banco para o formato Deal do frontend
  const items = page.items.map((o: any) => {
    // Determinar status para o frontend
    let uiStatus = "fila";
    if (o.status === "APPROVED") uiStatus = "aprovada";
    else if (o.status === "SCHEDULED") uiStatus = "agendada";
    else if (o.status === "PUBLISHED") uiStatus = "publicada";
    else if (o.status === "REJECTED" || o.status === "FAILED") uiStatus = "ignorada";
    else if (o.status === "EXPIRED") uiStatus = "expirada";

    // Criar histórico de preço dummy se não houver
    const currentPrice = Number(o.price);
    const refPrice = o.referencePrice ? Number(o.referencePrice) : Number(o.previousPrice);
    const priceHistory = o.priceHistory && o.priceHistory.length > 0
      ? o.priceHistory.map((ph: any) => Number(ph.price))
      : [refPrice * 1.05, refPrice * 1.02, refPrice, currentPrice];

    return {
      id: o.id,
      title: o.title,
      brand: o.brand?.name || "Sem marca",
      image: o.imageUrl || "",
      store: o.store?.slug || "shopee",
      category: o.category?.slug || "skincare",
      price: currentPrice,
      previousPrice: Number(o.previousPrice),
      averagePrice: refPrice,
      discount: Number(o.discountPercent),
      coupon: o.coupon?.code || null,
      freeShipping: o.freeShipping,
      rating: o.rating ? Number(o.rating) : 4.5,
      reviews: o.reviewCount || 0,
      aiScore: o.score || 70,
      aiVerdict: o.rejectionNote || "Aprovada nos critérios do motor",
      status: uiStatus,
      foundAt: o.detectedAt.toISOString(),
      scheduledFor: o.scheduledFor?.toISOString() || null,
      publishedAt: o.publishedAt?.toISOString() || null,
      channel: o.messages?.[0]?.channel?.handle || "@beautybot_ofertas",
      priceHistory,
    };
  });

  return ok({
    items,
    total: page.total,
    limit: page.limit,
    offset: page.offset,
    hasMore: page.hasMore,
  });
}, { name: "GET /api/v1/offers" });
