/**
 * Contrato dos provedores de IA.
 *
 * Desacoplamento simétrico ao de StoreConnector: adicionar Claude, GPT, Gemini
 * ou um modelo local significa implementar esta interface e registrar.
 * O service de IA fala com esta abstração, nunca com um provedor específico.
 *
 * A IA no BeautyBot não é apenas geradora de texto — é um serviço de
 * análise de promoções. Ela recebe contexto estruturado (preços, histórico,
 * avaliações) e devolve decisão estruturada (score, veredicto, motivos).
 */

export interface OfferAnalysisContext {
  offerId: string;
  title: string;
  currentPrice: number;
  previousPrice: number;
  referencePrice?: number;
  lowestEverPrice?: number;
  discountPercent: number;
  discountAmount: number;
  belowAveragePct?: number;
  rating?: number;
  reviewCount?: number;
  soldCount30d?: number;
  sellerReputation?: number;
  brandName?: string;
  categoryName?: string;
  couponCode?: string;
  freeShipping: boolean;
  availability: string;
  storeName: string;
  priceHistoryDays?: number;
  priceHistorySamples?: number;
}

export interface OfferAnalysisResult {
  /** Score de 0 a 100. */
  score: number;
  /** Veredicto: publicar, rejeitar ou mandar para revisão. */
  verdict: "APPROVE" | "REJECT" | "REVIEW";
  /** Confiança de 0 a 1. */
  confidence: number;
  /** Motivo da rejeição, se aplicável. */
  rejectionReason?: string;
  /** Lista de razões que levaram à decisão. */
  reasons: string[];
  /** Resumo da análise. */
  summary?: string;
  /** Título sugerido para a publicação. */
  suggestedTitle?: string;
  /** Descrição sugerida. */
  suggestedDescription?: string;
  /** Destaque do cupom, se houver. */
  couponHighlight?: string;
  /** Tokens consumidos. */
  inputTokens: number;
  outputTokens: number;
  /** Latência em ms. */
  latencyMs: number;
}

export interface CopywritingContext {
  title: string;
  price: number;
  previousPrice: number;
  discountPercent: number;
  couponCode?: string;
  freeShipping: boolean;
  rating?: number;
  reviewCount?: number;
  storeName: string;
  categoryName?: string;
  targetAudience?: string;
}

export interface CopyResult {
  headline: string;
  body: string;
  callToAction: string;
  emojis: string[];
  latencyMs: number;
}

export interface AiHealthReport {
  healthy: boolean;
  latencyMs: number;
  model?: string;
  message?: string;
}

export interface AiProvider {
  /** Identificador único (ex.: "anthropic-claude-v1", "mock-scorer"). */
  readonly key: string;
  /** Nome para exibição. */
  readonly name: string;

  /** Analisa uma oferta e devolve score + veredicto. */
  analyzeOffer(ctx: OfferAnalysisContext): Promise<OfferAnalysisResult>;

  /** Gera texto de publicação (opcional — nem todo provider suporta). */
  generateCopy?(ctx: CopywritingContext): Promise<CopyResult>;

  /** Verificação de saúde do provedor. */
  healthCheck(): Promise<AiHealthReport>;
}
