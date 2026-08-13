import { createHash } from "node:crypto";
import type { Product, Offer } from "@prisma/client";
import { createLogger } from "@/server/core/logger";
import { offerRepository, type CreateOfferInput } from "@/server/repositories/offer.repository";
import { productRepository } from "@/server/repositories/product.repository";
import { pricingService } from "./pricing.service";
import { queueService } from "@/server/queue/queue.service";

const log = createLogger("offer.service");

/**
 * Serviço de ofertas.
 *
 * O coração do BeautyBot. Decide o que é uma promoção digna de ser publicada,
 * cria a oferta e enfileira a análise da IA — tudo na mesma transação lógica.
 *
 * Regra fundamental: desconto real é calculado contra a **mediana** do
 * histórico, não contra o listPrice declarado pela loja. Se a mediana dos
 * últimos 90 dias é R$ 80 e a loja diz "de R$ 150 por R$ 70", o desconto
 * real é 12,5% (contra R$ 80), não 53% (contra R$ 150).
 */

export interface OfferDetectionResult {
  offersCreated: number;
  offersSkipped: number;
  offers: Offer[];
}

export class OfferService {
  /**
   * Avalia um lote de produtos e cria ofertas para os que passarem nos filtros.
   *
   * Filtros aplicados:
   * 1. Preço atual deve existir
   * 2. Preço de referência deve existir (= tem histórico)
   * 3. Desconto real ≥ limiar da categoria (ou global de 35%)
   * 4. Deduplicação: mesmo produto/preço/dia não gera oferta duplicada
   */
  async detectOffers(
    products: Product[],
    options: {
      storeId: string;
      executionId?: string;
      minDiscountPercent?: number;
    },
  ): Promise<OfferDetectionResult> {
    const minDiscount = options.minDiscountPercent ?? 35;
    let offersCreated = 0;
    let offersSkipped = 0;
    const offers: Offer[] = [];

    for (const product of products) {
      try {
        const offer = await this.evaluateProduct(product, {
          storeId: options.storeId,
          executionId: options.executionId,
          minDiscountPercent: minDiscount,
        });

        if (offer) {
          offers.push(offer);
          offersCreated++;
        } else {
          offersSkipped++;
        }
      } catch (e) {
        log.warn("Falha ao avaliar produto para oferta", {
          productId: product.id,
          error: e,
        });
        offersSkipped++;
      }
    }

    if (offersCreated > 0) {
      log.info("Ofertas detectadas", {
        storeId: options.storeId,
        created: offersCreated,
        skipped: offersSkipped,
      });
    }

    return { offersCreated, offersSkipped, offers };
  }

  /**
   * Avalia um único produto e, se qualificar, cria a oferta.
   */
  private async evaluateProduct(
    product: Product,
    opts: { storeId: string; executionId?: string; minDiscountPercent: number },
  ): Promise<Offer | null> {
    // 1. Preço atual precisa existir
    if (!product.currentPrice) return null;

    const currentPrice = Number(product.currentPrice);
    if (currentPrice <= 0) return null;

    // 2. Buscar preço de referência (mediana do histórico)
    const ref = await pricingService.getReferencePrice(product.id);

    // Se não tem referência, usa listPrice como fallback
    let previousPrice: number;
    if (ref.referencePrice && ref.sampleCount >= 3) {
      previousPrice = ref.referencePrice;
    } else if (product.listPrice) {
      previousPrice = Number(product.listPrice);
    } else {
      // Sem referência nenhuma: não dá para validar desconto
      return null;
    }

    // 3. Calcular desconto real
    if (previousPrice <= currentPrice) return null;

    const discountAmount = previousPrice - currentPrice;
    const discountPercent = (discountAmount / previousPrice) * 100;

    if (discountPercent < opts.minDiscountPercent) return null;

    // 4. Deduplicação
    const dedupeKey = this.computeDedupeKey(product.id, currentPrice);
    const existing = await offerRepository.findByDedupeKey(dedupeKey);
    if (existing) return null;

    // 5. Calcular métricas adicionais
    const belowAveragePct = ref.referencePrice
      ? ((ref.referencePrice - currentPrice) / ref.referencePrice) * 100
      : undefined;

    // Buscar imagem primária
    const images = await productRepository.findPrimaryImage(product.id);

    // 6. Criar a oferta
    const input: CreateOfferInput = {
      productId: product.id,
      storeId: opts.storeId,
      categoryId: product.categoryId ?? undefined,
      brandId: product.brandId ?? undefined,
      executionId: opts.executionId,
      title: product.title,
      imageUrl: images?.url,
      price: currentPrice,
      previousPrice,
      referencePrice: ref.referencePrice ?? undefined,
      lowestEverPrice: ref.lowestEver ?? undefined,
      discountPercent: Math.round(discountPercent * 100) / 100,
      discountAmount: Math.round(discountAmount * 100) / 100,
      belowAveragePct: belowAveragePct ? Math.round(belowAveragePct * 100) / 100 : undefined,
      currency: product.currency,
      freeShipping: false,
      availability: product.availability as CreateOfferInput["availability"],
      rating: product.rating ? Number(product.rating) : undefined,
      reviewCount: product.reviewCount,
      dedupeKey,
    };

    const offer = await offerRepository.create(input);

    // 7. Enfileirar avaliação pela IA (na mesma transação lógica)
    try {
      await queueService.enqueueOnce(
        "ai.evaluate-offer",
        { offerId: offer.id },
        `ai-eval-${offer.id}`,
      );
    } catch (e) {
      log.warn("Falha ao enfileirar avaliação da IA", {
        offerId: offer.id,
        error: e,
      });
    }

    return offer;
  }

  /**
   * Chave de deduplicação: sha256(productId | preço | data).
   *
   * O mesmo produto ao mesmo preço no mesmo dia não gera duas ofertas.
   * A granularidade diária é intencional: se o preço muda e volta no
   * mesmo dia, é uma oferta nova.
   */
  private computeDedupeKey(productId: string, price: number): string {
    const day = new Date().toISOString().slice(0, 10);
    const payload = `${productId}|${price.toFixed(2)}|${day}`;
    return createHash("sha256").update(payload).digest("hex");
  }

  /** Aprova uma oferta manualmente (operador). */
  async approve(offerId: string, userId?: string) {
    return offerRepository.transition(offerId, "APPROVED", {
      actorType: "USER",
      actorId: userId,
      decisionSource: "MANUAL",
      reason: "Aprovada manualmente pelo operador",
    });
  }

  /** Rejeita uma oferta manualmente (operador). */
  async reject(offerId: string, reason: string, userId?: string) {
    return offerRepository.transition(offerId, "REJECTED", {
      actorType: "USER",
      actorId: userId,
      decisionSource: "MANUAL",
      reason,
      rejectionNote: reason,
    });
  }

  /** Ofertas esperando decisão humana. */
  pendingReview(limit = 20) {
    return offerRepository.findPendingReview(limit);
  }

  /** Ofertas prontas para publicação. */
  readyToPublish(limit = 10) {
    return offerRepository.findReadyToPublish(limit);
  }

  /** Contadores por status para o dashboard. */
  statusSummary() {
    return offerRepository.countByStatus();
  }
}

export const offerService = new OfferService();
