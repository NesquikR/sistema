/**
 * Contrato dos conectores de loja.
 *
 * Este é o ponto de extensão central do BeautyBot: adicionar Shopee, Amazon ou
 * Mercado Livre deve significar **escrever uma classe que implementa
 * `StoreConnector` e registrá-la** — nunca tocar em service, scheduler ou fila.
 *
 * Três decisões que o contrato impõe de propósito:
 *
 * 1. `fetchProducts` devolve um `AsyncIterable` de páginas, não um array.
 *    Uma loja com 200 mil produtos não cabe na memória; iterar por página
 *    permite processar e descartar incrementalmente.
 * 2. O conector devolve `RawProduct` — dados **normalizados mas não julgados**.
 *    Decidir o que é promoção é responsabilidade da camada de negócio, não do
 *    conector. Assim, a regra vale igual para todas as lojas.
 * 3. `healthCheck` é obrigatório. Um conector que não sabe dizer se está de pé
 *    transforma qualquer diagnóstico em adivinhação.
 */

export interface ConnectorCapabilities {
  /** Busca por termo livre. */
  search: boolean;
  /** Navegação por categoria. */
  browseCategories: boolean;
  /** Consulta de um produto específico. */
  productDetail: boolean;
  /** Listagem de cupons. */
  coupons: boolean;
  /** Geração de link de afiliado pela própria API. */
  affiliateLinks: boolean;
  /** Recebe notificação de conversão por webhook. */
  conversionWebhook: boolean;
}

export interface RawImage {
  url: string;
  position?: number;
  width?: number;
  height?: number;
}

/** Produto como o conector o entrega: normalizado, mas sem julgamento. */
export interface RawProduct {
  externalId: string;
  title: string;
  url: string;
  price: number;
  listPrice?: number;
  currency?: string;

  brandName?: string;
  externalCategoryId?: string;
  externalCategoryPath?: string;

  sku?: string;
  gtin?: string;
  description?: string;

  sellerName?: string;
  sellerId?: string;
  sellerReputation?: number;

  rating?: number;
  reviewCount?: number;
  soldCount30d?: number;

  inStock?: boolean;
  freeShipping?: boolean;
  shippingCost?: number;
  couponCode?: string;

  images?: RawImage[];
  attributes?: Record<string, unknown>;
}

export interface FetchPage {
  products: RawProduct[];
  page: number;
  hasMore: boolean;
  /** Cursor opaco para APIs que não paginam por número. */
  cursor?: string;
}

export interface FetchOptions {
  /** Termos monitorados. */
  terms?: string[];
  /** Categorias externas a percorrer. */
  categoryIds?: string[];
  maxPages?: number;
  pageSize?: number;
  /** Só itens vistos ou alterados depois desta data, quando a API suportar. */
  since?: Date;
  signal?: AbortSignal;
}

export interface HealthReport {
  healthy: boolean;
  latencyMs: number;
  message?: string;
  quotaUsed?: number;
  quotaLimit?: number;
  checkedAt: Date;
}

export interface ConnectorContext {
  storeId: string;
  storeSlug: string;
  /** Credenciais já descriptografadas pela camada de serviço. */
  credentials: Record<string, string>;
  config: Record<string, unknown>;
  correlationId?: string;
  /**
   * Permite ao conector devolver credenciais renovadas para persistência.
   *
   * Existe por causa de tokens de uso único: o Mercado Livre invalida o refresh
   * token a cada renovação e emite outro. Sem esse retorno, a integração
   * funcionaria hoje e morreria na próxima renovação, sem nada indicando o
   * motivo. O conector não conhece o banco — quem grava é a camada de serviço.
   */
  onCredentialsUpdated?: (patch: Record<string, string>) => Promise<void>;
}

export interface StoreConnector {
  /** Igual a `Store.connectorKey`. É a chave do registro. */
  readonly key: string;
  readonly displayName: string;
  readonly version: string;
  readonly capabilities: ConnectorCapabilities;

  /** Chamado uma vez antes do primeiro uso no ciclo. */
  initialize?(ctx: ConnectorContext): Promise<void>;

  healthCheck(ctx: ConnectorContext): Promise<HealthReport>;

  /** Páginas de produtos, sob demanda. */
  fetchProducts(ctx: ConnectorContext, options: FetchOptions): AsyncIterable<FetchPage>;

  fetchProduct?(ctx: ConnectorContext, externalId: string): Promise<RawProduct | null>;

  buildAffiliateUrl?(ctx: ConnectorContext, productUrl: string): Promise<string>;

  /** Liberação de recursos ao fim do ciclo. */
  dispose?(ctx: ConnectorContext): Promise<void>;
}
