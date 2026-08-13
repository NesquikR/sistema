import { createLogger } from "@/server/core/logger";
import { aiRepository } from "@/server/repositories/ai.repository";
import { offerRepository } from "@/server/repositories/offer.repository";
import { aiProviderRegistry } from "@/server/providers/ai/registry";
import type { OfferAnalysisContext, OfferAnalysisResult } from "@/server/providers/ai/types";

const log = createLogger("ai.service");

/**
 * Serviço de inteligência artificial.
 *
 * Orquestra a análise de ofertas: monta o contexto, chama o provider (mock ou
 * real), grava o resultado e atualiza o status da oferta conforme o veredicto.
 *
 * A separação provider ↔ service é o que permite trocar o modelo de IA sem
 * tocar na lógica de negócio. O service decide **o que** analisar e **o que
 * fazer com o resultado**; o provider decide **como** analisar.
 */

export class AiService {
  /**
   * Analisa uma oferta e atualiza seu status conforme o veredicto.
   *
   * Fluxo:
   * 1. Busca a oferta com contexto completo
   * 2. Monta OfferAnalysisContext
   * 3. Chama o provider ativo
   * 4. Grava AiAnalysis no banco
   * 5. Transiciona o status da oferta
   */
  async evaluateOffer(offerId: string): Promise<{
    analysis: Awaited<ReturnType<typeof aiRepository.createAnalysis>>;
    result: OfferAnalysisResult;
  } | null> {
    // 1. Buscar oferta
    const offer = await offerRepository.findById(offerId);
    if (!offer) {
      log.warn("Oferta não encontrada para análise", { offerId });
      return null;
    }

    // Só analisa ofertas em estado elegível
    if (!["DETECTED", "VALIDATED"].includes(offer.status)) {
      log.debug("Oferta em estado não elegível para análise", {
        offerId,
        status: offer.status,
      });
      return null;
    }

    // 2. Buscar provider ativo
    const provider = aiProviderRegistry.getDefault();
    if (!provider) {
      log.warn("Nenhum AI provider registrado");
      return null;
    }

    // 3. Buscar modelo do banco
    const model = await aiRepository.findActiveModel("OFFER_SCORING");
    if (!model) {
      log.warn("Nenhum modelo de IA ativo para OFFER_SCORING");
      return null;
    }

    // 4. Montar contexto
    const ctx: OfferAnalysisContext = {
      offerId: offer.id,
      title: offer.title,
      currentPrice: Number(offer.price),
      previousPrice: Number(offer.previousPrice),
      referencePrice: offer.referencePrice ? Number(offer.referencePrice) : undefined,
      lowestEverPrice: offer.lowestEverPrice ? Number(offer.lowestEverPrice) : undefined,
      discountPercent: Number(offer.discountPercent),
      discountAmount: Number(offer.discountAmount),
      belowAveragePct: offer.belowAveragePct ? Number(offer.belowAveragePct) : undefined,
      rating: offer.rating ? Number(offer.rating) : undefined,
      reviewCount: offer.reviewCount ?? undefined,
      freeShipping: offer.freeShipping,
      availability: offer.availability,
      storeName: offer.store?.name ?? "Desconhecida",
      categoryName: offer.category?.name,
      brandName: offer.brand?.name,
    };

    // 5. Chamar provider
    log.debug("Iniciando análise de IA", { offerId, provider: provider.key });
    const result = await provider.analyzeOffer(ctx);

    // 6. Gravar análise
    const analysis = await aiRepository.createAnalysis({
      offerId,
      modelId: model.id,
      score: result.score,
      verdict: result.verdict,
      confidence: result.confidence,
      rejectionReason: result.rejectionReason,
      reasons: result.reasons,
      summary: result.summary,
      inputTokens: result.inputTokens,
      outputTokens: result.outputTokens,
      latencyMs: result.latencyMs,
      features: ctx as any,
    });

    // 7. Transicionar status da oferta
    if (result.verdict === "APPROVE") {
      await offerRepository.transition(offerId, "APPROVED", {
        actorType: "AI",
        score: result.score,
        decisionSource: "AI",
        reason: result.summary ?? `Score ${result.score}/100 — aprovado automaticamente`,
      });
      log.success("Oferta aprovada pela IA", {
        offerId,
        score: result.score,
        reasons: result.reasons,
      });
    } else if (result.verdict === "REJECT") {
      await offerRepository.transition(offerId, "REJECTED", {
        actorType: "AI",
        score: result.score,
        decisionSource: "AI",
        reason: result.summary ?? `Score ${result.score}/100 — rejeitado`,
        rejectionReason: result.rejectionReason,
        rejectionNote: result.reasons.join("; "),
      });
      log.info("Oferta rejeitada pela IA", {
        offerId,
        score: result.score,
        reason: result.rejectionReason,
      });
    } else {
      // REVIEW: vai para a fila de decisão humana
      await offerRepository.transition(offerId, "PENDING_REVIEW", {
        actorType: "AI",
        score: result.score,
        decisionSource: "AI",
        reason: result.summary ?? `Score ${result.score}/100 — aguardando revisão manual`,
      });
      log.info("Oferta encaminhada para revisão", {
        offerId,
        score: result.score,
      });
    }

    return { analysis, result };
  }

  /** Health check do provider de IA ativo. */
  async healthCheck() {
    const provider = aiProviderRegistry.getDefault();
    if (!provider) {
      return { healthy: false, message: "Nenhum AI provider registrado" };
    }
    return provider.healthCheck();
  }

  /** Análises recentes para o dashboard. */
  recentAnalyses(limit = 20) {
    return aiRepository.findRecent(limit);
  }

  /** Distribuição de veredictos para o donut chart. */
  verdictDistribution(since?: Date) {
    return aiRepository.countByVerdict(since);
  }

  /** Custo e performance. */
  costSummary(since?: Date) {
    return aiRepository.costSummary(since);
  }
}

export const aiService = new AiService();
