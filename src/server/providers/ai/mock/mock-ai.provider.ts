import type {
  AiProvider,
  AiHealthReport,
  OfferAnalysisContext,
  OfferAnalysisResult,
  CopywritingContext,
  CopyResult,
} from "../types";

/**
 * Mock AI Provider.
 *
 * Aplica regras determinísticas para produzir um score sem chamar nenhuma API
 * externa. Serve para dois propósitos:
 *
 * 1. **Desenvolvimento:** o pipeline inteiro funciona sem chave de API.
 * 2. **Baseline:** quando o provider real for adicionado, este mock serve de
 *    comparação — se o Claude concorda com as regras 95% do tempo, as regras
 *    estão boas; se diverge muito, algo no prompt precisa de ajuste.
 *
 * As regras refletem o domínio de promoções de beleza:
 *   - Desconto alto + muitas avaliações + vendedor confiável = score alto
 *   - Desconto "fake" (inflado) + pouca reputação = score baixo
 *   - Frete grátis e cupom são bônus
 */
export const mockAiProvider: AiProvider = {
  key: "mock-scorer-v1",
  name: "BeautyBot Rule Engine (Mock)",

  async analyzeOffer(ctx: OfferAnalysisContext): Promise<OfferAnalysisResult> {
    const started = Date.now();
    const reasons: string[] = [];
    let score = 50; // base

    // ── Desconto ────────────────────────────────────────────
    if (ctx.discountPercent >= 60) {
      score += 20;
      reasons.push(`Desconto excepcional de ${ctx.discountPercent.toFixed(0)}%`);
    } else if (ctx.discountPercent >= 45) {
      score += 12;
      reasons.push(`Bom desconto de ${ctx.discountPercent.toFixed(0)}%`);
    } else if (ctx.discountPercent >= 35) {
      score += 5;
      reasons.push(`Desconto moderado de ${ctx.discountPercent.toFixed(0)}%`);
    }

    // Abaixo da média histórica é sinal forte de promoção real
    if (ctx.belowAveragePct && ctx.belowAveragePct > 20) {
      score += 10;
      reasons.push(`${ctx.belowAveragePct.toFixed(0)}% abaixo da mediana histórica`);
    } else if (ctx.belowAveragePct && ctx.belowAveragePct > 10) {
      score += 5;
      reasons.push(`${ctx.belowAveragePct.toFixed(0)}% abaixo da mediana`);
    }

    // Preço muito próximo do menor histórico
    if (ctx.lowestEverPrice && ctx.currentPrice <= ctx.lowestEverPrice * 1.05) {
      score += 8;
      reasons.push("Preço próximo do menor já registrado");
    }

    // ── Confiabilidade ─────────────────────────────────────
    if (ctx.rating && ctx.rating >= 4.5 && (ctx.reviewCount ?? 0) >= 100) {
      score += 8;
      reasons.push(`Excelente reputação: ${ctx.rating}★ com ${ctx.reviewCount} avaliações`);
    } else if (ctx.rating && ctx.rating >= 4.0 && (ctx.reviewCount ?? 0) >= 30) {
      score += 4;
      reasons.push(`Boa reputação: ${ctx.rating}★ com ${ctx.reviewCount} avaliações`);
    } else if (!ctx.rating || (ctx.reviewCount ?? 0) < 10) {
      score -= 5;
      reasons.push("Poucas avaliações — confiabilidade limitada");
    }

    if (ctx.sellerReputation && ctx.sellerReputation >= 4.5) {
      score += 4;
      reasons.push("Vendedor bem avaliado");
    } else if (ctx.sellerReputation && ctx.sellerReputation < 3.5) {
      score -= 8;
      reasons.push("Vendedor com reputação baixa");
    }

    // ── Bônus ──────────────────────────────────────────────
    if (ctx.freeShipping) {
      score += 3;
      reasons.push("Frete grátis");
    }

    if (ctx.couponCode) {
      score += 5;
      reasons.push(`Cupom disponível: ${ctx.couponCode}`);
    }

    if (ctx.soldCount30d && ctx.soldCount30d >= 500) {
      score += 4;
      reasons.push(`Popular: ${ctx.soldCount30d} vendas/30d`);
    }

    // ── Penalidades ───────────────────────────────────────
    if (ctx.availability === "OUT_OF_STOCK") {
      score -= 30;
      reasons.push("Produto indisponível");
    } else if (ctx.availability === "LOW_STOCK") {
      score += 2;
      reasons.push("Estoque baixo — urgência natural");
    }

    // Sem histórico de preço suficiente, desconto pode ser fabricado
    if ((ctx.priceHistorySamples ?? 0) < 3) {
      score -= 10;
      reasons.push("Histórico de preço insuficiente para validar desconto real");
    }

    // Clamp
    score = Math.max(0, Math.min(100, Math.round(score)));

    // Veredicto
    let verdict: OfferAnalysisResult["verdict"];
    let rejectionReason: string | undefined;

    if (score >= 85) {
      verdict = "APPROVE";
    } else if (score >= 50) {
      verdict = "REVIEW";
    } else {
      verdict = "REJECT";
      if (ctx.availability === "OUT_OF_STOCK") {
        rejectionReason = "OUT_OF_STOCK";
      } else if ((ctx.priceHistorySamples ?? 0) < 3 && ctx.discountPercent > 50) {
        rejectionReason = "FAKE_DISCOUNT";
      } else if (ctx.sellerReputation && ctx.sellerReputation < 3.5) {
        rejectionReason = "LOW_SELLER_REPUTATION";
      } else {
        rejectionReason = "OTHER";
      }
    }

    const latencyMs = Date.now() - started;

    return {
      score,
      verdict,
      confidence: 0.75, // mock → confiança moderada fixa
      rejectionReason,
      reasons,
      summary: `Score ${score}/100 — ${verdict === "APPROVE" ? "Publicação automática" : verdict === "REVIEW" ? "Aguardando revisão" : "Rejeitada"}`,
      suggestedTitle: ctx.title,
      inputTokens: 0,
      outputTokens: 0,
      latencyMs,
    };
  },

  async generateCopy(ctx: CopywritingContext): Promise<CopyResult> {
    const started = Date.now();

    const discount = Math.round(ctx.discountPercent);
    const headline = `🔥 ${discount}% OFF — ${ctx.title}`;
    const priceFormatted = ctx.price.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
    const prevFormatted = ctx.previousPrice.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

    const lines = [
      `💰 De ${prevFormatted} por ${priceFormatted}`,
    ];

    if (ctx.couponCode) lines.push(`🎟 Cupom: ${ctx.couponCode}`);
    if (ctx.freeShipping) lines.push("🚚 Frete grátis");
    if (ctx.rating) lines.push(`⭐ ${ctx.rating} (${ctx.reviewCount ?? 0} avaliações)`);

    return {
      headline,
      body: lines.join("\n"),
      callToAction: "👉 Ver oferta",
      emojis: ["🔥", "💰", "🎟", "🚚", "⭐"],
      latencyMs: Date.now() - started,
    };
  },

  async healthCheck(): Promise<AiHealthReport> {
    return {
      healthy: true,
      latencyMs: 0,
      model: "rule-engine",
      message: "Mock AI provider operacional",
    };
  },
};
