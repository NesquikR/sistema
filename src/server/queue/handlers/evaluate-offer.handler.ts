import { createLogger } from "@/server/core/logger";
import { aiService } from "@/server/services/ai.service";
import type { HandlerDefinition, JobContext } from "@/server/queue/types";

const log = createLogger("handler.evaluate-offer");

/**
 * Handler de avaliação de oferta pela IA.
 *
 * Chamado após a detecção de uma oferta. O AI service:
 *   1. Monta o contexto completo (preço, histórico, avaliações, etc.)
 *   2. Chama o provider de IA (mock ou real)
 *   3. Grava a análise
 *   4. Atualiza o status da oferta (APPROVED, REJECTED ou PENDING_REVIEW)
 *
 * Se APPROVED, enfileira automaticamente o job de publicação.
 */

interface EvaluateOfferPayload {
  offerId: string;
}

export const evaluateOfferHandler: HandlerDefinition<EvaluateOfferPayload> = {
  name: "ai.evaluate-offer",
  queue: "analysis",
  timeoutMs: 60_000,
  maxAttempts: 2,

  async handler(payload, _ctx: JobContext) {
    const { offerId } = payload;

    const result = await aiService.evaluateOffer(offerId);

    if (!result) {
      return { message: "Oferta não elegível para análise" };
    }

    // Se aprovada, enfileirar publicação
    if (result.result.verdict === "APPROVE") {
      try {
        const { queueService } = await import("@/server/queue/queue.service");
        await queueService.enqueueOnce(
          "publishing.send-offer",
          { offerId },
          `pub-${offerId}`,
        );
        log.info("Publicação enfileirada", { offerId });
      } catch (e) {
        log.warn("Falha ao enfileirar publicação", { offerId, error: e });
      }
    }

    return {
      message: `Oferta ${offerId}: score ${result.result.score}, verdict ${result.result.verdict}`,
      data: {
        score: result.result.score,
        verdict: result.result.verdict,
        reasons: result.result.reasons,
      },
    };
  },
};
