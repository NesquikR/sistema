import { createHash } from "node:crypto";
import { RateLimitError, UnauthorizedError, UpstreamError } from "@/server/core/errors";
import { createLogger } from "@/server/core/logger";
import type {
  ConnectorContext,
  FetchOptions,
  FetchPage,
  HealthReport,
  RawProduct,
  StoreConnector,
} from "@/server/providers/types";

const log = createLogger("providers.shopee");

const ENDPOINT = "https://open-api.affiliate.shopee.com.br/graphql";

let clockSkewMs = 0;

interface ShopeeNode {
  itemId: number | string;
  productName: string;
  offerLink?: string;
  productLink?: string;
  imageUrl?: string;
  price?: string;
  priceMin?: string;
  priceMax?: string;
  priceDiscountRate?: number;
  sales?: number;
  ratingStar?: string;
  shopName?: string;
  shopId?: number | string;
  commissionRate?: string;
}

interface ShopeeResponse {
  data?: {
    productOfferV2?: {
      nodes?: ShopeeNode[];
      pageInfo?: { hasNextPage?: boolean; page?: number; limit?: number };
    };
    generateShortLink?: {
      shortLink?: string;
    };
  };
  errors?: { message?: string; extensions?: { code?: number } }[];
}

/**
 * Conector do Programa de Afiliados da Shopee.
 *
 * A autenticação é por assinatura em cada requisição, não por token: o header
 * carrega `SHA256(appId + timestamp + payload + appSecret)`. Como o timestamp
 * entra na assinatura, a janela de validade é curta — relógio do servidor
 * fora de sincronia é uma causa comum de 401 aqui, e por isso o erro
 * correspondente diz isso explicitamente em vez de "não autorizado".
 */
export class ShopeeProvider implements StoreConnector {
  readonly key = "shopee-affiliate-v1";
  readonly displayName = "Shopee Brasil";
  readonly version = "1.0.0";
  readonly capabilities = {
    search: true,
    browseCategories: false,
    productDetail: false,
    coupons: false,
    affiliateLinks: true,
    conversionWebhook: false,
  };

  async healthCheck(ctx: ConnectorContext): Promise<HealthReport> {
    const started = Date.now();

    try {
      const data = await this.query(
        ctx,
        `{ productOfferV2(keyword: "protetor solar", limit: 1) {
             nodes { itemId productName }
             pageInfo { hasNextPage }
           } }`,
      );

      const count = data.data?.productOfferV2?.nodes?.length ?? 0;
      return {
        healthy: true,
        latencyMs: Date.now() - started,
        message: `Assinatura aceita pela Shopee. Consulta de teste retornou ${count} item(ns).`,
        checkedAt: new Date(),
      };
    } catch (e) {
      return {
        healthy: false,
        latencyMs: Date.now() - started,
        message: e instanceof Error ? e.message : "Falha desconhecida",
        checkedAt: new Date(),
      };
    }
  }

  async *fetchProducts(
    ctx: ConnectorContext,
    options: FetchOptions,
  ): AsyncIterable<FetchPage> {
    const terms = options.terms?.length ? options.terms : ["beleza"];
    const limit = Math.min(options.pageSize ?? 50, 50);
    const maxPages = options.maxPages ?? 3;

    for (const term of terms) {
      for (let page = 1; page <= maxPages; page++) {
        options.signal?.throwIfAborted();

        const data = await this.query(
          ctx,
          `{ productOfferV2(keyword: ${JSON.stringify(term)}, limit: ${limit}, page: ${page}) {
               nodes {
                 itemId productName offerLink productLink imageUrl
                 price priceMin priceMax priceDiscountRate
                 sales ratingStar shopName shopId commissionRate
               }
               pageInfo { hasNextPage page limit }
             } }`,
          options.signal,
        );

        const offer = data.data?.productOfferV2;
        const nodes = offer?.nodes ?? [];
        if (!nodes.length) break;

        const hasMore = Boolean(offer?.pageInfo?.hasNextPage) && page < maxPages;

        yield {
          page,
          hasMore,
          products: nodes.map((n) => this.normalize(n)),
        };

        if (!hasMore) break;
      }
    }
  }

  async buildAffiliateUrl(ctx: ConnectorContext, productUrl: string): Promise<string> {
    try {
      const response = await this.query(
        ctx,
        `mutation {
          generateShortLink(input: { originUrl: ${JSON.stringify(productUrl)} }) {
            shortLink
          }
        }`
      );

      const shortLink = response.data?.generateShortLink?.shortLink;
      if (!shortLink) {
        throw new Error("Shopee não retornou shortLink no payload da mutation");
      }

      return shortLink;
    } catch (e) {
      log.error("Falha ao gerar link de afiliado na Shopee", { productUrl, error: e });
      throw e;
    }
  }

  // -------------------------------------------------------------------------

  private async query<T>(
    ctx: ConnectorContext,
    query: string,
    signal?: AbortSignal,
    isRetry = false,
  ): Promise<ShopeeResponse> {
    const appId = ctx.credentials.app_id?.trim();
    const appSecret = ctx.credentials.app_secret?.trim();

    if (!appId || !appSecret) {
      throw new UnauthorizedError("App ID e App Secret são obrigatórios para a Shopee");
    }

    const normalizedQuery = query.replace(/\s+/g, " ").trim();
    const payload = JSON.stringify({ query: normalizedQuery });
    const timestamp = Math.floor((Date.now() - clockSkewMs) / 1000);
    const signature = createHash("sha256")
      .update(`${appId}${timestamp}${payload}${appSecret}`)
      .digest("hex");

    const response = await fetch(ENDPOINT, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `SHA256 Credential=${appId},Timestamp=${timestamp},Signature=${signature}`,
      },
      body: payload,
      signal,
    });

    const serverDate = response.headers.get("date");
    if (serverDate) {
      clockSkewMs = Date.now() - Date.parse(serverDate);
    }

    const body = (await response.json().catch(() => ({}))) as ShopeeResponse;

    const hasAuthError = response.status === 401 || response.status === 403 || 
      (body.errors && body.errors.some(e => e.message?.includes("Invalid Credential")));

    if (hasAuthError && !isRetry) {
      log.warn("Falha de autenticação na Shopee (possível drift), tentando novamente com relógio sincronizado...", {
        skewMs: clockSkewMs
      });
      return this.query<T>(ctx, query, signal, true);
    }

    if (response.status === 401 || response.status === 403) {
      throw new UnauthorizedError(
        "A Shopee recusou a assinatura. Verifique App ID e App Secret — " +
          "e confirme que o relógio do servidor está sincronizado, pois o timestamp faz parte da assinatura.",
      );
    }

    if (response.status === 429) {
      throw new RateLimitError("Limite de requisições da Shopee atingido");
    }

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      throw new UpstreamError(
        `Shopee respondeu HTTP ${response.status}: ${text.slice(0, 200)}`,
        { retryable: response.status >= 500 },
      );
    }

    if (body.errors?.length) {
      const message = body.errors.map((e) => e.message).filter(Boolean).join("; ");
      log.warn("Shopee retornou erro no corpo GraphQL", { message });
      throw new UnauthorizedError(`Shopee recusou a consulta: ${message || "erro sem detalhe"}`);
    }

    return body;
  }

  private normalize(node: ShopeeNode): RawProduct {
    const price = Number(node.price ?? node.priceMin ?? 0);
    const discountRate = Number(node.priceDiscountRate ?? 0);

    // A Shopee informa o desconto em %, não o preço original.
    const listPrice =
      discountRate > 0 && discountRate < 100
        ? Number((price / (1 - discountRate / 100)).toFixed(2))
        : undefined;

    return {
      externalId: String(node.itemId),
      title: node.productName,
      url: node.offerLink ?? node.productLink ?? "",
      price,
      listPrice,
      currency: "BRL",
      sellerName: node.shopName,
      sellerId: node.shopId ? String(node.shopId) : undefined,
      rating: node.ratingStar ? Number(node.ratingStar) : undefined,
      soldCount30d: node.sales,
      inStock: true,
      images: node.imageUrl ? [{ url: node.imageUrl, position: 0 }] : undefined,
      attributes: { commissionRate: node.commissionRate },
    };
  }
}

export const shopeeProvider = new ShopeeProvider();
