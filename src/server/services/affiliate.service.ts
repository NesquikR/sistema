import { randomBytes } from "node:crypto";
import { createLogger } from "@/server/core/logger";
import { affiliateRepository } from "@/server/repositories/affiliate.repository";
import { offerRepository } from "@/server/repositories/offer.repository";
import { providerRegistry } from "@/server/providers/registry";
import { connectorService } from "@/server/services/connector.service";
import type { AffiliateLink } from "@prisma/client";

const log = createLogger("affiliate.service");

/**
 * Serviço de Monetização e Afiliados.
 *
 * Gerencia a conversão de links de produtos originais para links de afiliados
 * monetizados, bem como o encurtamento de links.
 */
export class AffiliateService {
  /**
   * Gera um link de afiliado encurtado para uma oferta específica.
   *
   * Se já existir, retorna o existente.
   */
  async generateLinkForOffer(offerId: string): Promise<AffiliateLink> {
    const existing = await affiliateRepository.findLinkForOffer(offerId);
    if (existing) return existing;

    const offer = await offerRepository.findById(offerId);
    if (!offer) {
      throw new Error(`Oferta não encontrada para link de afiliado: ${offerId}`);
    }

    const store = offer.store;
    const program = await affiliateRepository.findDefaultProgramForStore(store.id);

    let targetUrl = offer.product?.url || offer.store?.homepageUrl || "";
    let trackingTag = program?.trackingTag || undefined;

    // Se o conector suportar a capacidade de gerar link de afiliado pela API
    if (providerRegistry.has(store.connectorKey)) {
      const connector = providerRegistry.get(store.connectorKey);
      if (connector.buildAffiliateUrl) {
        try {
          const connectorCtx = await connectorService.buildContext(store);
          targetUrl = await connector.buildAffiliateUrl(connectorCtx, targetUrl);
          log.debug("Link de afiliado gerado via conector", { offerId, connectorKey: store.connectorKey });
        } catch (e) {
          log.warn("Erro ao gerar link de afiliado via conector, usando fallback", {
            offerId,
            error: e,
          });
        }
      }
    }

    // Gerar slug curto de 8 caracteres
    const shortSlug = randomBytes(4).toString("hex");

    const link = await affiliateRepository.createLink({
      storeId: store.id,
      programId: program?.id,
      productId: offer.productId,
      offerId: offer.id,
      originalUrl: offer.product?.url || "",
      targetUrl,
      shortSlug,
      trackingTag,
    });

    // Associa o link recém criado como o link primário da oferta
    await offerRepository.setAffiliateLink(offer.id, link.id);

    log.info("Link de afiliado criado e associado", { offerId, slug: shortSlug });
    return link;
  }

  /**
   * Rastreia um clique e retorna a URL de redirecionamento correspondente.
   */
  async trackClick(shortSlug: string): Promise<string> {
    const link = await affiliateRepository.findByShortSlug(shortSlug);
    if (!link) {
      log.warn("Link encurtado não encontrado ou inativo", { shortSlug });
      throw new Error(`Link encurtado não encontrado: ${shortSlug}`);
    }

    await affiliateRepository.incrementClick(link.id);

    // Grava estatística/clique se o banco estiver conectado (tratado pelo rep)
    try {
      await affiliateRepository.recordClick(link.id, link.offerId);
    } catch (e) {
      // Falha ao gravar clique não deve impedir o redirecionamento do usuário
      log.warn("Falha ao registrar log de clique no banco", { linkId: link.id, error: e });
    }

    return link.targetUrl;
  }
}

export const affiliateService = new AffiliateService();
