import { createHash } from "node:crypto";
import type { Product } from "@prisma/client";
import { createLogger } from "@/server/core/logger";
import { productRepository, type UpsertProductInput, type UpsertResult } from "@/server/repositories/product.repository";
import type { RawProduct } from "@/server/providers/types";

const log = createLogger("product.service");

/**
 * Serviço de produtos.
 *
 * Ponte entre o que o conector entrega (RawProduct) e o que o banco armazena
 * (Product). Responsabilidades:
 *   - Normalização de título (lowercase, trim, espaços duplicados)
 *   - Cálculo de contentHash para evitar UPDATEs desnecessários
 *   - Upsert em lote com contagem de criados/atualizados/ignorados
 */

export class ProductService {
  /** Normaliza um título para comparação e busca. */
  normalizeTitle(title: string): string {
    return title
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^\w\s-]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  /**
   * Hash do conteúdo relevante do produto.
   *
   * Inclui apenas campos que, quando mudam, justificam um UPDATE. Campos como
   * `lastSeenAt` são excluídos de propósito: se só eles mudarem, o produto é
   * tocado com `lastSeenAt` mas sem reescrever todas as colunas.
   */
  computeContentHash(raw: RawProduct): string {
    const payload = JSON.stringify({
      t: raw.title,
      p: raw.price,
      lp: raw.listPrice,
      d: raw.description?.slice(0, 500),
      r: raw.rating,
      rc: raw.reviewCount,
      s: raw.sellerName,
      a: raw.inStock,
    });
    return createHash("sha256").update(payload).digest("hex").slice(0, 16);
  }

  /** Converte RawProduct do conector para input do repositório. */
  toUpsertInput(raw: RawProduct, storeId: string, categoryId?: string): UpsertProductInput {
    return {
      storeId,
      externalId: raw.externalId,
      title: raw.title,
      normalizedTitle: this.normalizeTitle(raw.title),
      url: raw.url,
      currentPrice: raw.price,
      listPrice: raw.listPrice,
      currency: raw.currency ?? "BRL",
      categoryId,
      description: raw.description,
      sku: raw.sku,
      gtin: raw.gtin,
      sellerName: raw.sellerName,
      sellerId: raw.sellerId,
      sellerReputation: raw.sellerReputation,
      rating: raw.rating,
      reviewCount: raw.reviewCount,
      soldCount30d: raw.soldCount30d,
      availability: raw.inStock === false ? "OUT_OF_STOCK" : raw.inStock === true ? "IN_STOCK" : "UNKNOWN",
      contentHash: this.computeContentHash(raw),
      attributes: raw.attributes as any,
      images: raw.images?.map((img, i) => ({
        url: img.url,
        position: img.position ?? i,
        isPrimary: i === 0,
        width: img.width,
        height: img.height,
      })),
    };
  }

  /**
   * Processa um lote de produtos crus de um conector.
   *
   * Retorna contadores para alimentar o Execution.
   */
  async upsertBatch(
    rawProducts: RawProduct[],
    storeId: string,
    options: { executionId?: string; categoryResolver?: (externalCategoryId: string) => string | undefined } = {},
  ): Promise<{ created: number; updated: number; skipped: number; products: Product[] }> {
    let created = 0;
    let updated = 0;
    let skipped = 0;
    const products: Product[] = [];

    for (const raw of rawProducts) {
      try {
        const categoryId = raw.externalCategoryId && options.categoryResolver
          ? options.categoryResolver(raw.externalCategoryId)
          : undefined;

        const input = this.toUpsertInput(raw, storeId, categoryId);
        const result: UpsertResult = await productRepository.upsert(input);

        products.push(result.product);

        switch (result.action) {
          case "created": created++; break;
          case "updated": updated++; break;
          case "skipped": skipped++; break;
        }
      } catch (e) {
        log.warn("Falha ao processar produto", {
          externalId: raw.externalId,
          storeId,
          error: e,
        });
      }
    }

    log.info("Lote de produtos processado", {
      storeId,
      total: rawProducts.length,
      created,
      updated,
      skipped,
    });

    return { created, updated, skipped, products };
  }
}

export const productService = new ProductService();
