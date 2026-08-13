import { createLogger } from "@/server/core/logger";
import { telegramService } from "@/server/services/telegram.service";
import type { HandlerDefinition, JobContext } from "@/server/queue/types";

const log = createLogger("handler.publish-offer");

/**
 * Handler de publicação de oferta.
 *
 * Chamado quando uma oferta é aprovada (pela IA ou manualmente). O Telegram
 * service:
 *   1. Identifica o canal de destino (por categoria)
 *   2. Verifica throttling (limite/hora, limite/dia, janela)
 *   3. Renderiza o template de mensagem
 *   4. Envia pelo provider (mock ou bot real)
 *   5. Registra a mensagem e atualiza a oferta para PUBLISHED
 */

interface PublishOfferPayload {
  offerId: string;
}

export const publishOfferHandler: HandlerDefinition<PublishOfferPayload> = {
  name: "publishing.send-offer",
  queue: "publishing",
  timeoutMs: 30_000,
  maxAttempts: 3,

  async handler(payload, _ctx: JobContext) {
    const { offerId } = payload;

    const result = await telegramService.publishOffer(offerId);

    if (result.success) {
      return {
        message: `Oferta ${offerId} publicada com sucesso`,
        data: { messageId: result.messageId },
      };
    }

    // Se falhou por throttling, é retryable (atraso ajuda)
    if (result.reason?.includes("Limite") || result.reason?.includes("janela")) {
      log.info("Publicação adiada por throttle", { offerId, reason: result.reason });
      return { message: `Adiada: ${result.reason}` };
    }

    // Outros erros: lança para que o worker aplique retry
    throw new Error(result.reason ?? "Falha na publicação");
  },
};
