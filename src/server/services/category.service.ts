import { createLogger } from "@/server/core/logger";
import { categoryRepository } from "@/server/repositories/category.repository";
import type { Category } from "@prisma/client";

const log = createLogger("category.service");

/**
 * Serviço de Categorias.
 *
 * Gerencia a taxonomia e mapeamento de categorias de parceiros externos
 * para as categorias internas do BeautyBot.
 */
export class CategoryService {
  /** Resolve uma categoria interna por slug. */
  async getBySlug(slug: string): Promise<Category | null> {
    return categoryRepository.findBySlug(slug);
  }

  /** Retorna todas as categorias ativas. */
  async listActive(): Promise<Category[]> {
    return categoryRepository.findAllActive();
  }

  /** Retorna as categorias raiz com seus filhos mapeados. */
  async getTree() {
    return categoryRepository.findRoots();
  }

  /**
   * Associa uma categoria externa de uma loja a uma categoria interna.
   *
   * Útil para que, quando o conector importar produtos, o BeautyBot saiba
   * exatamente em qual categoria interna alocar (ex.: Shopee "Maquiagem de Boca" -> "Maquiagem").
   */
  async mapExternalCategory(
    storeId: string,
    externalCategoryId: string,
    categoryId: string,
    externalPath?: string,
  ) {
    const mapping = await categoryRepository.upsertStoreMapping(
      storeId,
      externalCategoryId,
      categoryId,
      externalPath,
    );
    log.info("Mapeamento de categoria associado", {
      storeId,
      externalCategoryId,
      categoryId,
    });
    return mapping;
  }

  /** Resolve a categoria interna correspondente para uma categoria externa de loja. */
  async resolveExternalCategory(storeId: string, externalCategoryId: string): Promise<string | undefined> {
    const mapping = await categoryRepository.findStoreMapping(storeId, externalCategoryId);
    return mapping?.categoryId;
  }
}

export const categoryService = new CategoryService();
