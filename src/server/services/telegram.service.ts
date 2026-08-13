import { createLogger } from "@/server/core/logger";
import { telegramRepository } from "@/server/repositories/telegram.repository";
import { offerRepository } from "@/server/repositories/offer.repository";
import type { TelegramProvider } from "@/server/providers/telegram/types";
import type { Offer, TelegramChannel, MessageTemplate } from "@prisma/client";

const log = createLogger("telegram.service");

/**
 * Serviço de publicação (Telegram).
 *
 * Orquestra o envio de mensagens: renderiza o template, verifica throttling,
 * envia pelo provider e registra tudo no banco.
 *
 * Throttling é aplicado no nível do canal:
 *   - maxPostsPerHour e maxPostsPerDay vivem no banco (TelegramChannel)
 *   - Posting window (08:00–22:00) também
 *   - Tudo configurável sem deploy
 */

// Provider será injetado pelo bootstrap
let telegramProvider: TelegramProvider | null = null;

export function setTelegramProvider(provider: TelegramProvider) {
  telegramProvider = provider;
  log.info("Telegram provider configurado", { key: provider.key });
}

export class TelegramService {
  /**
   * Publica uma oferta no canal apropriado.
   *
   * 1. Busca a oferta com contexto
   * 2. Identifica o canal de destino
   * 3. Verifica throttling
   * 4. Renderiza o template
   * 5. Envia pelo provider
   * 6. Grava a mensagem no banco
   * 7. Atualiza o status da oferta para PUBLISHED
   */
  async publishOffer(offerId: string): Promise<{ success: boolean; messageId?: string; reason?: string }> {
    if (!telegramProvider) {
      log.warn("Nenhum Telegram provider configurado");
      return { success: false, reason: "Nenhum Telegram provider configurado" };
    }

    // 1. Buscar oferta
    const offer = await offerRepository.findById(offerId);
    if (!offer) {
      return { success: false, reason: "Oferta não encontrada" };
    }

    if (offer.status !== "APPROVED") {
      return { success: false, reason: `Oferta em status ${offer.status}, esperado APPROVED` };
    }

    // 2. Identificar canal
    const channel = await this.resolveChannel(offer);
    if (!channel) {
      return { success: false, reason: "Nenhum canal de destino encontrado" };
    }

    // 3. Throttling
    const throttleResult = await this.checkThrottle(channel);
    if (!throttleResult.allowed) {
      log.info("Publicação adiada por throttling", {
        offerId,
        channel: channel.handle,
        reason: throttleResult.reason,
      });
      return { success: false, reason: throttleResult.reason };
    }

    // 4. Gerar link de afiliado
    let shortUrl = "";
    let affiliateLinkId: string | undefined;
    try {
      const { affiliateService } = await import("@/server/services/affiliate.service");
      const affiliateLink = await affiliateService.generateLinkForOffer(offer.id);
      shortUrl = `${process.env.APP_URL || "http://localhost:3000"}/go/${affiliateLink.shortSlug}`;
      affiliateLinkId = affiliateLink.id;
    } catch (e) {
      log.warn("Falha ao gerar link de afiliado, usando original", { offerId, error: e });
      shortUrl = offer.product?.url || "";
    }

    // 5. Renderizar template
    const template = await telegramRepository.findDefaultTemplate();
    const renderedText = this.renderTemplate(offer, template, shortUrl);

    // 6. Criar mensagem no banco (status SENDING)
    const message = await telegramRepository.createMessage({
      offerId,
      channelId: channel.id,
      templateId: template?.id,
      affiliateLinkId,
      renderedText,
      parseMode: template?.parseMode ?? "MARKDOWN_V2",
      status: "SENDING",
    });

    // 6. Enviar pelo provider
    try {
      const sent = await telegramProvider.sendMessage(
        channel.chatId,
        renderedText,
        { parseMode: template?.parseMode === "HTML" ? "HTML" : "MarkdownV2" },
      );

      // 7. Marcar como enviada
      await telegramRepository.markSent(message.id, sent.messageId);

      // 8. Registrar tentativa de sucesso
      await telegramRepository.recordAttempt(message.id, 1, {
        success: true,
        latencyMs: Date.now() - sent.sentAt.getTime(),
      });

      // 9. Atualizar oferta para PUBLISHED
      await offerRepository.transition(offerId, "PUBLISHED", {
        actorType: "SYSTEM",
        reason: `Publicada no canal ${channel.handle}`,
      });

      log.success("Oferta publicada", {
        offerId,
        channel: channel.handle,
        messageId: message.id,
      });

      return { success: true, messageId: message.id };
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : "Erro desconhecido";

      await telegramRepository.markFailed(message.id, errorMessage);
      await telegramRepository.recordAttempt(message.id, 1, {
        success: false,
        errorText: errorMessage,
      });

      // Marca a oferta como FAILED
      await offerRepository.transition(offerId, "FAILED", {
        actorType: "SYSTEM",
        reason: `Falha no envio: ${errorMessage}`,
      });

      log.error("Falha ao publicar oferta", {
        offerId,
        channel: channel.handle,
        error: e,
      });

      return { success: false, reason: errorMessage };
    }
  }

  /**
   * Renderiza o template de mensagem com os dados da oferta.
   *
   * Substituição simples de {{variáveis}} e blocos condicionais
   * {{#flag}}...{{/flag}}. Sem engine pesada de propósito: o template
   * mora no banco e é versionado — muda sem deploy.
   */
  private renderTemplate(
    offer: Offer & { coupon?: { code: string } | null },
    template?: MessageTemplate | null,
    shortUrl?: string,
  ): string {
    if (!template) {
      // Fallback sem template
      const discount = Number(offer.discountPercent).toFixed(0);
      const price = Number(offer.price).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
      const prev = Number(offer.previousPrice).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
      return `🔥 ${discount}% OFF — ${offer.title}\n\n💰 De ${prev} por ${price}\n\n👉 ${shortUrl || "Link em breve"}`;
    }

    let text = template.body;

    // Substituições simples
    const vars: Record<string, string> = {
      title: offer.title,
      price: Number(offer.price).toLocaleString("pt-BR", { minimumFractionDigits: 2 }),
      previousPrice: Number(offer.previousPrice).toLocaleString("pt-BR", { minimumFractionDigits: 2 }),
      discount: Number(offer.discountPercent).toFixed(0),
      coupon: offer.coupon?.code ?? "",
      rating: offer.rating ? Number(offer.rating).toFixed(1) : "—",
      reviewCount: String(offer.reviewCount ?? 0),
      link: shortUrl ?? "{{link}}",
    };

    for (const [key, value] of Object.entries(vars)) {
      text = text.replace(new RegExp(`\\{\\{${key}\\}\\}`, "g"), value);
    }

    // Blocos condicionais: {{#coupon}}...{{/coupon}}
    text = text.replace(/\{\{#(\w+)\}\}(.*?)\{\{\/\1\}\}/gs, (_, key, content) => {
      const val = vars[key];
      return val && val !== "" ? content : "";
    });

    // Limpar linhas vazias consecutivas
    text = text.replace(/\n{3,}/g, "\n\n").trim();

    return text;
  }

  /** Identifica o canal de destino com base na categoria da oferta. */
  private async resolveChannel(offer: { categoryId?: string | null }): Promise<TelegramChannel | null> {
    // Se a oferta tem categoria, busca canal mapeado
    if (offer.categoryId) {
      const channels = await telegramRepository.findActiveChannels();
      for (const channel of channels) {
        const hasCategory = (channel as unknown as { categories: { category: { id: string } }[] })
          .categories?.some((cc) => cc.category.id === offer.categoryId);
        if (hasCategory) return channel;
      }
    }

    // Fallback: canal primário
    return telegramRepository.findPrimaryChannel();
  }

  /** Verifica limites de publicação. */
  private async checkThrottle(channel: TelegramChannel): Promise<{ allowed: boolean; reason?: string }> {
    // Verificar janela de postagem
    const now = new Date();
    const currentTime = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;

    if (currentTime < channel.postingWindowStart || currentTime > channel.postingWindowEnd) {
      return { allowed: false, reason: `Fora da janela de postagem (${channel.postingWindowStart}–${channel.postingWindowEnd})` };
    }

    // Verificar limite por hora
    const sentLastHour = await telegramRepository.countSentLastHour(channel.id);
    if (sentLastHour >= channel.maxPostsPerHour) {
      return { allowed: false, reason: `Limite por hora atingido (${sentLastHour}/${channel.maxPostsPerHour})` };
    }

    // Verificar limite diário
    const sentToday = await telegramRepository.countSentToday(channel.id);
    if (sentToday >= channel.maxPostsPerDay) {
      return { allowed: false, reason: `Limite diário atingido (${sentToday}/${channel.maxPostsPerDay})` };
    }

    return { allowed: true };
  }

  /** Health check do provider. */
  async healthCheck() {
    if (!telegramProvider) {
      return { healthy: false, message: "Nenhum Telegram provider configurado" };
    }
    return telegramProvider.healthCheck();
  }
}

export const telegramService = new TelegramService();
