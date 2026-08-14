import { UpstreamError, UnauthorizedError, RateLimitError } from "@/server/core/errors";
import { createLogger } from "@/server/core/logger";
import { refreshAccessToken } from "./oauth";
import type {
  ConnectorContext,
  FetchOptions,
  FetchPage,
  HealthReport,
  RawProduct,
  StoreConnector,
} from "@/server/providers/types";

const log = createLogger("providers.mercadolivre");

const API = "https://api.mercadolibre.com";
const TOKEN_URL = `${API}/oauth/token`;
const TOKEN_SKEW_MS = 60_000; // renova 1 min antes de expirar

interface TokenState {
  accessToken: string;
  expiresAt: number;
}

interface MeliSearchResponse {
  results?: MeliItem[];
  paging?: { total: number; offset: number; limit: number };
}

interface MeliItem {
  id: string;
  title: string;
  permalink: string;
  price: number;
  original_price: number | null;
  currency_id: string;
  available_quantity?: number;
  sold_quantity?: number;
  condition?: string;
  thumbnail?: string;
  category_id?: string;
  seller?: { id?: number; nickname?: string };
  shipping?: { free_shipping?: boolean };
  attributes?: { id: string; name: string; value_name: string | null }[];
}

/**
 * Conector do Mercado Livre.
 *
 * Autentica por OAuth2 `client_credentials` e mantém o token em memória por
 * contexto de loja — pedir token novo a cada requisição consumiria a cota do
 * parceiro sem necessidade.
 *
 * Os erros da API são traduzidos para a hierarquia interna, e isso não é
 * cosmético: é o que faz a fila distinguir "credencial errada" (não adianta
 * repetir) de "429 / instabilidade" (vale repetir com backoff).
 */
export class MercadoLivreProvider implements StoreConnector {
  readonly key = "mercadolivre-v1";
  readonly displayName = "Mercado Livre";
  readonly version = "1.0.0";
  readonly capabilities = {
    search: true,
    browseCategories: true,
    productDetail: true,
    coupons: false,
    affiliateLinks: false,
    conversionWebhook: false,
  };

  private tokens = new Map<string, TokenState>();

  // -------------------------------------------------------------------------

  /**
   * O diagnóstico separa dois estados que, confundidos, levam o operador a
   * trocar chaves que estavam certas:
   *
   *   1. **Credenciais recusadas** — a ML não emitiu o token. É problema de
   *      Client ID/Secret.
   *   2. **Credenciais aceitas, acesso negado** — o token foi emitido, mas a
   *      aplicação não tem permissão no endpoint. Trocar a chave não resolve;
   *      o que falta é autorização.
   *
   * A distinção existe porque a ML restringiu `/sites/{site}/search`: aplicações
   * com token de aplicação (`client_credentials`) recebem 403 mesmo com chaves
   * perfeitamente válidas.
   */
  async healthCheck(ctx: ConnectorContext): Promise<HealthReport> {
    const started = Date.now();
    const site = this.siteId(ctx);

    // Etapa 1 — as credenciais são aceitas?
    try {
      await this.getToken(ctx, { force: true });
    } catch (e) {
      return {
        healthy: false,
        latencyMs: Date.now() - started,
        message: e instanceof Error ? e.message : "Falha desconhecida ao autenticar",
        checkedAt: new Date(),
      };
    }

    // Etapa 2 — o token dá acesso ao catálogo?
    try {
      const probe = await this.request<MeliSearchResponse>(
        ctx,
        `/sites/${site}/search?q=protetor%20solar&limit=1`,
      );

      return {
        healthy: true,
        latencyMs: Date.now() - started,
        message: `Autenticado no ${site}. Catálogo respondendo (${
          probe.paging?.total ?? 0
        } resultados na consulta de teste).`,
        checkedAt: new Date(),
      };
    } catch (e) {
      const denied = e instanceof UnauthorizedError;

      return {
        healthy: false,
        latencyMs: Date.now() - started,
        message: denied
          ? "Credenciais VÁLIDAS — o Mercado Livre emitiu o token normalmente. " +
            "O que falta é permissão: a aplicação recebeu 403 ao consultar o catálogo. " +
            "O endpoint de busca por site foi restringido pela ML e não aceita token de " +
            "aplicação (client_credentials); é preciso autorizar a aplicação na sua conta " +
            "(fluxo OAuth com redirect) ou solicitar acesso à API de busca. " +
            "Não troque suas chaves — elas estão corretas."
          : e instanceof Error
            ? e.message
            : "Falha desconhecida ao consultar o catálogo",
        checkedAt: new Date(),
      };
    }
  }

  async *fetchProducts(
    ctx: ConnectorContext,
    options: FetchOptions,
  ): AsyncIterable<FetchPage> {
    const site = this.siteId(ctx);
    const terms = options.terms?.length ? options.terms : ["beleza"];
    const pageSize = Math.min(options.pageSize ?? 50, 50); // teto da API
    const maxPages = options.maxPages ?? 3;

    for (const term of terms) {
      for (let page = 0; page < maxPages; page++) {
        options.signal?.throwIfAborted();

        const offset = page * pageSize;
        const path =
          `/sites/${site}/search?q=${encodeURIComponent(term)}` +
          `&limit=${pageSize}&offset=${offset}&official_store=all`;

        const data = await this.request<MeliSearchResponse>(ctx, path, options.signal);
        const items = data.results ?? [];

        if (!items.length) break;

        const total = data.paging?.total ?? 0;
        const hasMore = offset + items.length < total && page + 1 < maxPages;

        yield {
          page: page + 1,
          hasMore,
          products: items.map((item) => this.normalize(item)),
        };

        if (!hasMore) break;
      }
    }
  }

  async fetchProduct(ctx: ConnectorContext, externalId: string): Promise<RawProduct | null> {
    try {
      const item = await this.request<MeliItem>(ctx, `/items/${externalId}`);
      return this.normalize(item);
    } catch (e) {
      if (e instanceof UpstreamError && e.status === 404) return null;
      throw e;
    }
  }

  async dispose(ctx: ConnectorContext) {
    this.tokens.delete(ctx.storeId);
  }

  // -------------------------------------------------------------------------

  private siteId(ctx: ConnectorContext): string {
    return (ctx.credentials.site_id || (ctx.config.site_id as string) || "MLB").toUpperCase();
  }

  private async getToken(
    ctx: ConnectorContext,
    { force = false } = {},
  ): Promise<string> {
    const cached = this.tokens.get(ctx.storeId);
    if (!force && cached && cached.expiresAt > Date.now() + TOKEN_SKEW_MS) {
      return cached.accessToken;
    }

    // Caminho preferencial: token de usuário obtido via OAuth. É o único que
    // dá acesso ao catálogo — o token de aplicação recebe 403 na busca.
    const refreshToken = ctx.credentials.refresh_token?.trim();
    if (refreshToken) {
      return this.renewFromRefreshToken(ctx, refreshToken);
    }

    // Sem refresh token, resta um access_token avulso ainda válido.
    const accessToken = ctx.credentials.access_token?.trim();
    if (accessToken && !force) {
      return accessToken;
    }

    const clientId = ctx.credentials.client_id?.trim();
    const clientSecret = ctx.credentials.client_secret?.trim();

    if (!clientId || !clientSecret) {
      throw new UnauthorizedError(
        "Client ID e Client Secret são obrigatórios para o Mercado Livre",
      );
    }

    const response = await fetch(TOKEN_URL, {
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded",
        accept: "application/json",
      },
      body: new URLSearchParams({
        grant_type: "client_credentials",
        client_id: clientId,
        client_secret: clientSecret,
      }),
    });

    const body = (await response.json().catch(() => ({}))) as {
      access_token?: string;
      expires_in?: number;
      message?: string;
      error?: string;
      error_description?: string;
    };

    if (!response.ok || !body.access_token) {
      throw this.translateAuthError(response.status, body);
    }

    const state: TokenState = {
      accessToken: body.access_token,
      expiresAt: Date.now() + (body.expires_in ?? 21_600) * 1000,
    };
    this.tokens.set(ctx.storeId, state);

    log.debug("Token do Mercado Livre renovado", {
      store: ctx.storeSlug,
      expiraEmSegundos: body.expires_in,
    });

    return state.accessToken;
  }

  /**
   * Renova o access token e **devolve o novo refresh token para persistência**.
   *
   * A ML invalida o refresh token a cada uso. Se o novo não for gravado, a
   * próxima renovação falha com "invalid_grant" e a loja para de sincronizar
   * sem que nada tenha mudado na configuração — uma das falhas mais difíceis
   * de diagnosticar depois do fato.
   */
  private async renewFromRefreshToken(
    ctx: ConnectorContext,
    refreshToken: string,
  ): Promise<string> {
    const tokens = await refreshAccessToken({
      clientId: ctx.credentials.client_id?.trim() ?? "",
      clientSecret: ctx.credentials.client_secret?.trim() ?? "",
      refreshToken,
    });

    this.tokens.set(ctx.storeId, {
      accessToken: tokens.accessToken,
      expiresAt: Date.now() + tokens.expiresIn * 1000,
    });

    if (tokens.refreshToken && tokens.refreshToken !== refreshToken) {
      ctx.credentials.refresh_token = tokens.refreshToken;
      ctx.credentials.access_token = tokens.accessToken;

      if (ctx.onCredentialsUpdated) {
        await ctx.onCredentialsUpdated({
          refresh_token: tokens.refreshToken,
          access_token: tokens.accessToken,
        });
      } else {
        log.warn(
          "Refresh token renovado sem canal de persistência — a próxima renovação vai falhar",
          { store: ctx.storeSlug },
        );
      }
    }

    return tokens.accessToken;
  }

  /**
   * Traduz a resposta de erro do OAuth em algo que o operador entenda.
   * "invalid_client" sozinho na tela não diz a ninguém que a Client Secret
   * está errada.
   */
  private translateAuthError(
    status: number,
    body: { message?: string; error?: string; error_description?: string },
  ): Error {
    const detail = body.error_description || body.message || body.error || "";

    if (status === 400 || status === 401) {
      const lower = detail.toLowerCase();

      if (lower.includes("client_id") || lower.includes("invalid_client")) {
        return new UnauthorizedError(
          `Credenciais recusadas pelo Mercado Livre: verifique o Client ID e o Client Secret. (${detail})`,
        );
      }
      if (lower.includes("grant_type") || lower.includes("unsupported")) {
        return new UnauthorizedError(
          "O Mercado Livre recusou o fluxo client_credentials para esta aplicação. " +
            "Aplicações novas podem exigir o fluxo de autorização com redirect. " +
            `(${detail})`,
        );
      }
      return new UnauthorizedError(
        `Autenticação recusada pelo Mercado Livre (HTTP ${status}): ${detail || "sem detalhe"}`,
      );
    }

    if (status === 429) {
      return new RateLimitError("Limite de requisições do Mercado Livre atingido");
    }

    return new UpstreamError(
      `Mercado Livre respondeu HTTP ${status} ao emitir o token: ${detail || "sem detalhe"}`,
    );
  }

  private async request<T>(
    ctx: ConnectorContext,
    path: string,
    signal?: AbortSignal,
  ): Promise<T> {
    const token = await this.getToken(ctx);

    const response = await fetch(`${API}${path}`, {
      headers: { authorization: `Bearer ${token}`, accept: "application/json" },
      signal,
    });

    if (response.status === 401) {
      // Token pode ter sido revogado antes de expirar: uma nova tentativa.
      this.tokens.delete(ctx.storeId);
      const retryToken = await this.getToken(ctx, { force: true });
      const retry = await fetch(`${API}${path}`, {
        headers: { authorization: `Bearer ${retryToken}`, accept: "application/json" },
        signal,
      });
      if (!retry.ok) throw await this.translateApiError(retry);
      return (await retry.json()) as T;
    }

    if (!response.ok) throw await this.translateApiError(response);

    return (await response.json()) as T;
  }

  private async translateApiError(response: Response): Promise<Error> {
    const text = await response.text().catch(() => "");

    if (response.status === 429) {
      const retryAfter = Number(response.headers.get("retry-after")) * 1000;
      return new RateLimitError(
        "Limite de requisições do Mercado Livre atingido",
        Number.isFinite(retryAfter) ? retryAfter : undefined,
      );
    }
    if (response.status === 403) {
      return new UnauthorizedError(
        "O Mercado Livre negou o acesso a este recurso. A aplicação pode não ter o escopo necessário.",
      );
    }

    return new UpstreamError(
      `Mercado Livre respondeu HTTP ${response.status}: ${text.slice(0, 200)}`,
      { status: response.status >= 500 ? 502 : 400, retryable: response.status >= 500 },
    );
  }

  private normalize(item: MeliItem): RawProduct {
    const brand = item.attributes?.find((a) => a.id === "BRAND")?.value_name ?? undefined;
    const gtin = item.attributes?.find((a) => a.id === "GTIN")?.value_name ?? undefined;

    return {
      externalId: item.id,
      title: item.title,
      url: item.permalink,
      price: item.price,
      listPrice: item.original_price ?? undefined,
      currency: item.currency_id ?? "BRL",
      brandName: brand,
      gtin,
      externalCategoryId: item.category_id,
      sellerName: item.seller?.nickname,
      sellerId: item.seller?.id ? String(item.seller.id) : undefined,
      soldCount30d: item.sold_quantity,
      inStock: (item.available_quantity ?? 0) > 0,
      freeShipping: item.shipping?.free_shipping ?? false,
      images: item.thumbnail ? [{ url: item.thumbnail, position: 0 }] : undefined,
      attributes: { condition: item.condition },
    };
  }
}

export const mercadoLivreProvider = new MercadoLivreProvider();
