import type { NextRequest } from "next/server";
import { bootstrap } from "@/server/bootstrap";
import { withApiHandler } from "@/server/http/handler";
import { ok } from "@/server/http/responses";
import { db } from "@/server/db";
import { createHash } from "node:crypto";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MOCK_DEALS = [
  {
    title: "Sérum Facial Vitamina C 30ml",
    brand: "Principia",
    categorySlug: "skincare",
    storeSlug: "shopee",
    price: 68.9,
    previousPrice: 129.9,
    discountPercent: 47,
    coupon: "BEAUTY20",
    rating: 4.8,
    reviews: 3241,
    aiScore: 94,
    verdict: "Menor preço em 90 dias · histórico estável · alta conversão na categoria",
    status: "PENDING_REVIEW", // Fila
  },
  {
    title: "Protetor Solar Facial FPS 70 Toque Seco",
    brand: "La Roche-Posay",
    categorySlug: "skincare",
    storeSlug: "amazon",
    price: 74.5,
    previousPrice: 139.9,
    discountPercent: 46,
    coupon: null,
    rating: 4.9,
    reviews: 12480,
    aiScore: 91,
    verdict: "Queda real de 42% · marca com CTR acima da média",
    status: "PENDING_REVIEW", // Fila
  },
  {
    title: "Paleta de Sombras 18 Cores Nude",
    brand: "Ruby Rose",
    categorySlug: "maquiagem",
    storeSlug: "shopee",
    price: 29.9,
    previousPrice: 59.9,
    discountPercent: 50,
    coupon: "RR15",
    rating: 4.6,
    reviews: 8930,
    aiScore: 88,
    verdict: "Ticket baixo mas volume alto · boa para horário de pico",
    status: "PENDING_REVIEW", // Fila
  },
  {
    title: "Esponja de Maquiagem Kit 4un",
    brand: "Real Techniques",
    categorySlug: "maquiagem",
    storeSlug: "amazon",
    price: 44.9,
    previousPrice: 89.9,
    discountPercent: 50,
    coupon: "RT10",
    rating: 4.8,
    reviews: 7310,
    aiScore: 86,
    verdict: "Agendada para o pico das 19h",
    status: "SCHEDULED", // Agendada
    scheduledForOffsetMinutes: 120, // agendada para daqui a 2h
  },
  {
    title: "Sabonete Facial Ácido Salicílico",
    brand: "CeraVe",
    categorySlug: "skincare",
    storeSlug: "amazon",
    price: 42.9,
    previousPrice: 79.9,
    discountPercent: 46,
    coupon: null,
    rating: 4.9,
    reviews: 9840,
    aiScore: 90,
    verdict: "Agendada para o pico das 20h",
    status: "SCHEDULED", // Agendada
    scheduledForOffsetMinutes: 180, // agendada para daqui a 3h
  },
  {
    title: "Água Micelar 5 em 1 400ml",
    brand: "Garnier",
    categorySlug: "skincare",
    storeSlug: "amazon",
    price: 24.9,
    previousPrice: 44.9,
    discountPercent: 44,
    coupon: null,
    rating: 4.8,
    reviews: 28410,
    aiScore: 90,
    verdict: "Item recorrente de alta rotatividade",
    status: "PUBLISHED", // Publicada
  },
  {
    title: "Perfume Feminino Eau de Parfum 100ml",
    brand: "Natura",
    categorySlug: "perfumaria",
    storeSlug: "beleza-na-web",
    price: 189.9,
    previousPrice: 329.9,
    discountPercent: 42,
    coupon: "BNW30",
    rating: 4.9,
    reviews: 1840,
    aiScore: 87,
    verdict: "Ticket alto · margem de afiliado superior",
    status: "PUBLISHED", // Publicada
  },
  {
    title: "Kit Maquiagem Completo 32 peças",
    brand: "Genérico",
    categorySlug: "maquiagem",
    storeSlug: "shopee",
    price: 89.9,
    previousPrice: 399.9,
    discountPercent: 77,
    coupon: null,
    rating: 3.4,
    reviews: 210,
    aiScore: 21,
    verdict: "Preço anterior inflado · desconto falso detectado",
    status: "REJECTED", // Ignorada
  },
];

export const POST = withApiHandler(async (_request: NextRequest) => {
  await bootstrap("web");

  // 1. Carregar lojas e categorias reais do banco
  const dbStores = await db.store.findMany();
  const dbCategories = await db.category.findMany();

  const storeMap = Object.fromEntries(dbStores.map(s => [s.slug, s.id]));
  const catMap = Object.fromEntries(dbCategories.map(c => [c.slug, c.id]));

  let seededCount = 0;

  for (const m of MOCK_DEALS) {
    const storeId = storeMap[m.storeSlug] || dbStores[0]?.id;
    const categoryId = catMap[m.categorySlug] || dbCategories[0]?.id;

    if (!storeId) continue;

    // Criar um ID único do produto baseado no título e loja
    const externalId = createHash("md5").update(`${m.title}|${m.storeSlug}`).digest("hex").slice(0, 16);

    // 2. Upsert do produto
    const product = await db.product.upsert({
      where: { storeId_externalId: { storeId, externalId } },
      update: {
        title: m.title,
        currentPrice: m.price,
        listPrice: m.previousPrice,
      },
      create: {
        storeId,
        externalId,
        title: m.title,
        normalizedTitle: m.title.toLowerCase(),
        url: `https://example.com/p/${externalId}`,
        currentPrice: m.price,
        listPrice: m.previousPrice,
        categoryId,
      },
    });

    const day = new Date().toISOString().slice(0, 10);
    const dedupeKey = `${product.id}|${m.price.toFixed(2)}|${day}`;

    // 3. Verificar se já existe a oferta
    const existingOffer = await db.offer.findUnique({
      where: { dedupeKey },
    });

    if (!existingOffer) {
      const scheduledFor = m.scheduledForOffsetMinutes
        ? new Date(Date.now() + m.scheduledForOffsetMinutes * 60_000)
        : null;

      const publishedAt = m.status === "PUBLISHED" ? new Date() : null;

      await db.offer.create({
        data: {
          productId: product.id,
          storeId,
          categoryId,
          title: m.title,
          price: m.price,
          previousPrice: m.previousPrice,
          referencePrice: m.previousPrice,
          discountPercent: m.discountPercent,
          discountAmount: m.previousPrice - m.price,
          dedupeKey,
          score: m.aiScore,
          status: m.status as any,
          rejectionNote: m.verdict,
          scheduledFor,
          publishedAt,
        },
      });

      seededCount++;
    }
  }

  return ok({ seededCount, message: `Seed de ofertas executado. ${seededCount} novas ofertas criadas.` });
}, { name: "POST /api/v1/offers/seed" });
