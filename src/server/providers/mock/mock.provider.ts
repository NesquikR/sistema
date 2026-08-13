import { createLogger } from "@/server/core/logger";
import type {
  ConnectorContext,
  FetchOptions,
  FetchPage,
  HealthReport,
  RawProduct,
  StoreConnector,
} from "@/server/providers/types";

const log = createLogger("providers.mock");

/**
 * Conector de referência.
 *
 * Não acessa rede e não é uma integração: existe para (a) provar que o contrato
 * `StoreConnector` é implementável de ponta a ponta, (b) permitir exercitar
 * scheduler, fila e pipeline sem depender de parceiro externo, e (c) servir de
 * modelo para os conectores reais.
 *
 * Os produtos são gerados por PRNG **determinístico**: o mesmo `seed` produz
 * sempre o mesmo resultado, o que torna qualquer teste sobre ele reproduzível.
 */

function seeded(seed: number) {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}

const NOUNS = [
  "Sérum Facial",
  "Protetor Solar",
  "Base Líquida",
  "Máscara Capilar",
  "Batom Matte",
  "Água Micelar",
  "Óleo Capilar",
  "Esmalte Gel",
];
const BRANDS = ["Aurora", "Lumine", "Petala", "Vivan", "Noor", "Cistus"];

export interface MockProviderOptions {
  /** Latência simulada por página, em ms. */
  latencyMs?: number;
  /** Probabilidade de falha por página (0–1), para exercitar retry. */
  failureRate?: number;
  productsPerPage?: number;
  totalPages?: number;
  seed?: number;
}

export class MockProvider implements StoreConnector {
  readonly key = "mock-connector-v1";
  readonly displayName = "Conector de referência";
  readonly version = "1.0.0";
  readonly capabilities = {
    search: true,
    browseCategories: true,
    productDetail: true,
    coupons: false,
    affiliateLinks: true,
    conversionWebhook: false,
  };

  private readonly options: Required<MockProviderOptions>;

  constructor(options: MockProviderOptions = {}) {
    this.options = {
      latencyMs: options.latencyMs ?? 40,
      failureRate: options.failureRate ?? 0,
      productsPerPage: options.productsPerPage ?? 12,
      totalPages: options.totalPages ?? 3,
      seed: options.seed ?? 42,
    };
  }

  async initialize(ctx: ConnectorContext) {
    log.debug("Conector inicializado", { store: ctx.storeSlug });
  }

  async healthCheck(ctx: ConnectorContext): Promise<HealthReport> {
    const started = Date.now();
    await this.delay(this.options.latencyMs);
    return {
      healthy: true,
      latencyMs: Date.now() - started,
      message: `Conector de referência operacional (${ctx.storeSlug})`,
      checkedAt: new Date(),
    };
  }

  async *fetchProducts(
    ctx: ConnectorContext,
    options: FetchOptions,
  ): AsyncIterable<FetchPage> {
    const pages = Math.min(options.maxPages ?? this.options.totalPages, this.options.totalPages);
    const size = options.pageSize ?? this.options.productsPerPage;

    for (let page = 1; page <= pages; page++) {
      options.signal?.throwIfAborted();
      await this.delay(this.options.latencyMs);

      if (this.options.failureRate > 0 && Math.random() < this.options.failureRate) {
        throw new Error(`Falha simulada na página ${page}`);
      }

      yield {
        page,
        hasMore: page < pages,
        products: this.generate(page, size, ctx.storeSlug),
      };
    }
  }

  async fetchProduct(ctx: ConnectorContext, externalId: string): Promise<RawProduct | null> {
    await this.delay(this.options.latencyMs);
    const [, pageStr, indexStr] = externalId.split("-");
    const page = Number(pageStr);
    const index = Number(indexStr);
    if (!Number.isFinite(page) || !Number.isFinite(index)) return null;
    return this.generate(page, index + 1, ctx.storeSlug)[index] ?? null;
  }

  async buildAffiliateUrl(_ctx: ConnectorContext, productUrl: string) {
    const url = new URL(productUrl);
    url.searchParams.set("tag", "beautybot-mock");
    return url.toString();
  }

  async dispose(ctx: ConnectorContext) {
    log.debug("Conector liberado", { store: ctx.storeSlug });
  }

  // -------------------------------------------------------------------------

  private generate(page: number, size: number, storeSlug: string): RawProduct[] {
    const rnd = seeded(this.options.seed + page * 1000);

    return Array.from({ length: size }, (_, i) => {
      const listPrice = Number((40 + rnd() * 260).toFixed(2));
      const discount = 0.15 + rnd() * 0.5;
      const price = Number((listPrice * (1 - discount)).toFixed(2));
      const noun = NOUNS[Math.floor(rnd() * NOUNS.length)];
      const brand = BRANDS[Math.floor(rnd() * BRANDS.length)];

      return {
        externalId: `mock-${page}-${i}`,
        title: `${noun} ${brand} ${Math.floor(rnd() * 400 + 30)}ml`,
        url: `https://exemplo.local/${storeSlug}/p/mock-${page}-${i}`,
        price,
        listPrice,
        currency: "BRL",
        brandName: brand,
        externalCategoryId: `cat-${Math.floor(rnd() * 6) + 1}`,
        sellerName: `${brand} Oficial`,
        sellerReputation: Number((4 + rnd()).toFixed(2)),
        rating: Number((3.5 + rnd() * 1.5).toFixed(1)),
        reviewCount: Math.floor(rnd() * 8000),
        soldCount30d: Math.floor(rnd() * 2000),
        inStock: true,
        freeShipping: rnd() > 0.4,
        images: [{ url: `https://exemplo.local/img/mock-${page}-${i}.jpg`, position: 0 }],
      } satisfies RawProduct;
    });
  }

  private delay(ms: number) {
    return new Promise<void>((resolve) => setTimeout(resolve, ms));
  }
}

export const mockProvider = new MockProvider();
