import { createLogger } from "@/server/core/logger";
import { offerRepository } from "@/server/repositories/offer.repository";
import { settingRepository } from "@/server/repositories/setting.repository";
import { telegramRepository } from "@/server/repositories/telegram.repository";
import type { Offer } from "@prisma/client";

const log = createLogger("services.whatsapp");

export class WhatsappService {
  async publishOffer(offerId: string): Promise<{ success: boolean; reason?: string }> {
    try {
      // 1. Verificar se a integração está ativa nas configurações
      const activeSetting = await settingRepository.findOne("whatsapp_active");
      const isActive = activeSetting?.value === true;
      if (!isActive) {
        return { success: true, reason: "WhatsApp desativado nas configurações" };
      }

      // 2. Buscar parâmetros do gateway
      const urlSetting = await settingRepository.findOne("whatsapp_gateway_url");
      const groupIdSetting = await settingRepository.findOne("whatsapp_group_id");
      const tokenSetting = await settingRepository.findOne("whatsapp_token");

      const gatewayUrl = urlSetting?.value as string;
      const groupId = groupIdSetting?.value as string;
      const token = tokenSetting?.value as string;

      if (!gatewayUrl || !groupId) {
        log.warn("Configurações do WhatsApp incompletas", { offerId, gatewayUrl, groupId });
        return { success: false, reason: "Configurações do WhatsApp incompletas (URL ou Grupo ausente)" };
      }

      // 3. Buscar oferta
      const offer = await offerRepository.findById(offerId);
      if (!offer) {
        return { success: false, reason: "Oferta não encontrada" };
      }

      // 4. Gerar link de afiliado
      let shortUrl = "";
      try {
        const { affiliateService } = await import("@/server/services/affiliate.service");
        const affiliateLink = await affiliateService.generateLinkForOffer(offer.id);
        shortUrl = `${process.env.APP_URL || "https://sistemagrupo.netlify.app"}/go/${affiliateLink.shortSlug}`;
      } catch (e) {
        log.warn("Falha ao gerar link de afiliado, usando original", { offerId, error: e });
        shortUrl = offer.product?.url || "";
      }

      // 5. Renderizar texto da mensagem usando o template padrão do Telegram
      const template = await telegramRepository.findDefaultTemplate();
      const rawText = this.renderTemplate(offer, template, shortUrl);

      // 6. Formatar o texto do Markdown V2 do Telegram para o WhatsApp
      const whatsappText = this.formatForWhatsapp(rawText);

      // 7. Configurar Headers da requisição
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };

      if (token) {
        headers["apikey"] = token;
        headers["client-token"] = token;
        headers["Authorization"] = `Bearer ${token}`;
      }

      // Payload universal compatível com Z-API e Evolution API
      const payload = {
        phone: groupId,
        number: groupId,
        message: whatsappText,
        text: whatsappText,
      };

      log.info("Disparando oferta para o WhatsApp", { offerId, gatewayUrl, groupId });

      const response = await fetch(gatewayUrl, {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(`HTTP ${response.status}: ${text}`);
      }

      log.success("Oferta publicada no WhatsApp com sucesso", { offerId });
      return { success: true };
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Erro desconhecido";
      log.error("Falha ao enviar oferta para o WhatsApp", { offerId, error: e });
      return { success: false, reason: msg };
    }
  }

  private renderTemplate(
    offer: any,
    template: any,
    shortUrl: string,
  ): string {
    if (!template) {
      const discount = Number(offer.discountPercent).toFixed(0);
      const price = Number(offer.price).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
      const prev = Number(offer.previousPrice).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
      return `🔥 ${discount}% OFF — ${offer.title}\n\n💰 De ${prev} por ${price}\n\n👉 ${shortUrl || "Link em breve"}`;
    }

    let text = template.body;

    const vars: Record<string, string> = {
      title: offer.title,
      price: Number(offer.price).toLocaleString("pt-BR", { minimumFractionDigits: 2 }),
      previousPrice: Number(offer.previousPrice).toLocaleString("pt-BR", { minimumFractionDigits: 2 }),
      discount: Number(offer.discountPercent).toFixed(0),
      coupon: offer.coupon?.code ?? "",
      rating: offer.rating ? Number(offer.rating).toFixed(1) : "—",
      reviewCount: String(offer.reviewCount ?? 0),
      link: shortUrl,
    };

    for (const [key, value] of Object.entries(vars)) {
      text = text.replace(new RegExp(`\\{\\{${key}\\}\\}`, "g"), value);
    }

    text = text.replace(/\{\{#(\w+)\}\}(.*?)\{\{\/\1\}\}/gs, (_: string, key: string, content: string) => {
      const val = vars[key];
      return val && val !== "" ? content : "";
    });

    return text;
  }

  private formatForWhatsapp(text: string): string {
    // 1. Remove escapes do Markdown V2 do Telegram (ex: \. vira ., \- vira -)
    let formatted = text.replace(/\\([_*[\]()~`>#+\-=|{}.!])/g, "$1");

    // 2. Converte negrito do Markdown do Telegram (**bold** ou __bold__) para o padrão do WhatsApp (*bold*)
    formatted = formatted.replace(/\*\*(.*?)\*\*/g, "*$1*");
    
    // 3. Garante que se o usuário tiver usado marcações HTML como <b>, sejam tratadas
    formatted = formatted.replace(/<b>(.*?)<\/b>/g, "*$1*");
    formatted = formatted.replace(/<strong>(.*?)<\/strong>/g, "*$1*");

    return formatted;
  }
}

export const whatsappService = new WhatsappService();
