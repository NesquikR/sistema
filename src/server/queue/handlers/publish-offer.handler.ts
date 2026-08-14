import { createLogger } from "@/server/core/logger";
import { telegramService } from "@/server/services/telegram.service";
import { whatsappService } from "@/server/services/whatsapp.service";
import type { HandlerDefinition, JobContext } from "@/server/queue/types";

const log = createLogger("handler.publish-offer");

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

    // Dispara a publicação para o Telegram e o WhatsApp em paralelo
    const [telegramResult, whatsappResult] = await Promise.all([
      telegramService.publishOffer(offerId).catch((err) => ({
        success: false,
        messageId: undefined as string | undefined,
        reason: err instanceof Error ? err.message : "Erro desconhecido no Telegram",
      })),
      whatsappService.publishOffer(offerId).catch((err) => ({
        success: false,
        reason: err instanceof Error ? err.message : "Erro desconhecido no WhatsApp",
      })),
    ]);

    if (telegramResult.success || whatsappResult.success) {
      const details = [];
      if (telegramResult.success) details.push(`Telegram (${telegramResult.messageId})`);
      if (whatsappResult.success) details.push("WhatsApp");

      return {
        message: `Oferta ${offerId} publicada no(s) canal(is): ${details.join(", ")}`,
      };
    }

    // Se ambos falharam e um deles foi por throttling, avisa
    const throttleReason =
      (telegramResult.reason?.includes("Limite") || telegramResult.reason?.includes("janela")
        ? telegramResult.reason
        : null) ||
      (whatsappResult.reason?.includes("Limite") || whatsappResult.reason?.includes("janela")
        ? whatsappResult.reason
        : null);

    if (throttleReason) {
      log.info("Publicação adiada por throttle", { offerId, reason: throttleReason });
      return { message: `Adiada: ${throttleReason}` };
    }

    // Lança erro geral se tudo falhar
    throw new Error(
      `Falha na publicação geral. Telegram: ${telegramResult.reason ?? "sucesso"}. WhatsApp: ${
        whatsappResult.reason ?? "sucesso"
      }`,
    );
  },
};
