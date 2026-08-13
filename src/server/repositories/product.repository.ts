import type { Prisma, Product, ProductImage } from "@prisma/client";
import { db } from "@/server/db";
import { BaseRepository, toPage, type DbClient, type Page } from "./base.repository";

/**
 * Repositório de produtos.
 *
 * O método mais importante é `upsertBatch`: recebe o que o conector encontrou
 * e atualiza o catálogo sem duplicar. O `contentHash` evita UPDATEs quando
 * nada mudou — com 50k produtos varridos a cada 15 min, a maioria não muda
 * entre ciclos.
 */

export interface ProductFilter {
  storeId?: string;
  categoryId?: string;
  brandId?: string;
  isActive?: boolean;
  search?: string;
  limit?: number;
  offset?: number;
}

export interface UpsertProductInput {
  storeId: string;
  externalId: string;
  title: string;
  normalizedTitle: string;
  url: string;
  currentPrice?: number;
  listPrice?: number;
  currency?: string;
  brandId?: string;
  categoryId?: string;
  description?: string;
  sku?: string;
  gtin?: string;
  sellerName?: string;
  sellerId?: string;
  sellerReputation?: number;
  rating?: number;
  reviewCount?: number;
  soldCount30d?: number;
  availability?: "IN_STOCK" | "LOW_STOCK" | "OUT_OF_STOCK" | "PREORDER" | "UNKNOWN";
  contentHash: string;
  attributes?: Prisma.InputJsonValue;
  images?: Array<{
    url: string;
    position: number;
    isPrimary: boolean;
    width?: number;
    height?: number;
  }>;
}

export interface UpsertResult {
  product: Product;
  action: "created" | "updated" | "skipped";
}

export class ProductRepository extends BaseRepository {
  withTransaction(tx: Prisma.TransactionClient) {
    return new ProductRepository(tx);
  }

  private notDeleted(): Prisma.ProductWhereInput {
    return { deletedAt: null };
  }

  async findMany(filter: ProductFilter = {}): Promise<Page<Product>> {
    const { limit = 50, offset = 0 } = filter;

    const where: Prisma.ProductWhereInput = {
      ...this.notDeleted(),
      ...(filter.storeId ? { storeId: filter.storeId } : {}),
      ...(filter.categoryId ? { categoryId: filter.categoryId } : {}),
      ...(filter.brandId ? { brandId: filter.brandId } : {}),
      ...(filter.isActive !== undefined ? { isActive: filter.isActive } : {}),
      ...(filter.search
        ? {
            OR: [
              { title: { contains: filter.search, mode: "insensitive" } },
              { normalizedTitle: { contains: filter.search, mode: "insensitive" } },
              { sku: { contains: filter.search, mode: "insensitive" } },
            ],
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      this.client.product.findMany({
        where,
        orderBy: [{ lastSeenAt: "desc" }],
        take: limit,
        skip: offset,
      }),
      this.client.product.count({ where }),
    ]);

    return toPage(items, total, limit, offset);
  }

  findById(id: string) {
    return this.client.product.findFirst({
      where: { id, ...this.notDeleted() },
      include: { images: { orderBy: { position: "asc" } }, store: true, category: true, brand: true },
    });
  }

  findByStoreAndExternalId(storeId: string, externalId: string) {
    return this.client.product.findUnique({
      where: { storeId_externalId: { storeId, externalId } },
    });
  }

  /**
   * Upsert individual: cria ou atualiza um produto.
   *
   * O `contentHash` é a peça central: se o hash não mudou desde a última
   * varredura, o produto recebe apenas um toque em `lastSeenAt` — sem reescrever
   * colunas que não mudaram, o que reduz WAL e I/O em ordens de magnitude.
   */
  async upsert(input: UpsertProductInput): Promise<UpsertResult> {
    const existing = await this.findByStoreAndExternalId(input.storeId, input.externalId);

    if (existing && existing.contentHash === input.contentHash) {
      // Nada mudou: toca lastSeenAt e pula
      await this.client.product.update({
        where: { id: existing.id },
        data: { lastSeenAt: new Date(), isActive: true },
      });
      return { product: existing, action: "skipped" };
    }

    const data: Prisma.ProductCreateInput = {
      store: { connect: { id: input.storeId } },
      externalId: input.externalId,
      title: input.title,
      normalizedTitle: input.normalizedTitle,
      url: input.url,
      currentPrice: input.currentPrice,
      listPrice: input.listPrice,
      currency: input.currency ?? "BRL",
      description: input.description,
      sku: input.sku,
      gtin: input.gtin,
      sellerName: input.sellerName,
      sellerId: input.sellerId,
      sellerReputation: input.sellerReputation,
      rating: input.rating,
      reviewCount: input.reviewCount ?? 0,
      soldCount30d: input.soldCount30d,
      availability: input.availability ?? "UNKNOWN",
      contentHash: input.contentHash,
      attributes: input.attributes ?? undefined,
      isActive: true,
      lastSeenAt: new Date(),
      ...(input.brandId ? { brand: { connect: { id: input.brandId } } } : {}),
      ...(input.categoryId ? { category: { connect: { id: input.categoryId } } } : {}),
    };

    if (existing) {
      const product = await this.client.product.update({
        where: { id: existing.id },
        data: {
          title: input.title,
          normalizedTitle: input.normalizedTitle,
          url: input.url,
          currentPrice: input.currentPrice,
          listPrice: input.listPrice,
          currency: input.currency ?? "BRL",
          description: input.description,
          sku: input.sku,
          gtin: input.gtin,
          sellerName: input.sellerName,
          sellerId: input.sellerId,
          sellerReputation: input.sellerReputation,
          rating: input.rating,
          reviewCount: input.reviewCount ?? 0,
          soldCount30d: input.soldCount30d,
          availability: input.availability ?? "UNKNOWN",
          contentHash: input.contentHash,
          attributes: input.attributes ?? undefined,
          isActive: true,
          lastSeenAt: new Date(),
          ...(input.brandId ? { brandId: input.brandId } : {}),
          ...(input.categoryId ? { categoryId: input.categoryId } : {}),
        },
      });
      return { product, action: "updated" };
    }

    const product = await this.client.product.create({ data });

    // Imagens: cria em lote após o produto
    if (input.images?.length) {
      await this.client.productImage.createMany({
        data: input.images.map((img) => ({
          productId: product.id,
          url: img.url,
          position: img.position,
          isPrimary: img.isPrimary,
          width: img.width,
          height: img.height,
        })),
        skipDuplicates: true,
      });
    }

    return { product, action: "created" };
  }

  /** Marca produtos que sumiram da loja como inativos. */
  async markUnseen(storeId: string, olderThan: Date) {
    const { count } = await this.client.product.updateMany({
      where: {
        storeId,
        lastSeenAt: { lt: olderThan },
        isActive: true,
        deletedAt: null,
      },
      data: { isActive: false },
    });
    return count;
  }

  /** Contadores rápidos para o dashboard. */
  async countByStore(storeId: string) {
    return this.client.product.count({
      where: { storeId, ...this.notDeleted(), isActive: true },
    });
  }

  async countAll() {
    return this.client.product.count({
      where: { ...this.notDeleted(), isActive: true },
    });
  }

  async findPrimaryImage(productId: string) {
    return this.client.productImage.findFirst({
      where: { productId, isPrimary: true },
      select: { url: true },
    });
  }

  async findActiveProductIdsForStore(storeId: string, limit = 5000): Promise<string[]> {
    const products = await this.client.product.findMany({
      where: { storeId, isActive: true, deletedAt: null },
      select: { id: true },
      take: limit,
    });
    return products.map((p) => p.id);
  }
}

export const productRepository = new ProductRepository(db as DbClient);
