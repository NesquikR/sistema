import type { Prisma, Category } from "@prisma/client";
import { db } from "@/server/db";
import { BaseRepository, toPage, type DbClient, type Page } from "./base.repository";

/**
 * Repositório de categorias.
 *
 * Taxonomia interna hierárquica com materialized path. A hierarquia é
 * rastreada por `parentId` + `path` (e.g. "/skincare/limpeza-facial").
 */

export interface CategoryFilter {
  parentId?: string | null;
  isActive?: boolean;
  search?: string;
  limit?: number;
  offset?: number;
}

export class CategoryRepository extends BaseRepository {
  withTransaction(tx: Prisma.TransactionClient) {
    return new CategoryRepository(tx);
  }

  private notDeleted(): Prisma.CategoryWhereInput {
    return { deletedAt: null };
  }

  async findMany(filter: CategoryFilter = {}): Promise<Page<Category>> {
    const { limit = 100, offset = 0 } = filter;

    const where: Prisma.CategoryWhereInput = {
      ...this.notDeleted(),
      ...(filter.isActive !== undefined ? { isActive: filter.isActive } : {}),
      ...(filter.parentId !== undefined ? { parentId: filter.parentId } : {}),
      ...(filter.search
        ? {
            OR: [
              { name: { contains: filter.search, mode: "insensitive" } },
              { slug: { contains: filter.search, mode: "insensitive" } },
            ],
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      this.client.category.findMany({
        where,
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
        take: limit,
        skip: offset,
      }),
      this.client.category.count({ where }),
    ]);

    return toPage(items, total, limit, offset);
  }

  findById(id: string) {
    return this.client.category.findFirst({
      where: { id, ...this.notDeleted() },
      include: { parent: true, children: { where: this.notDeleted() } },
    });
  }

  findBySlug(slug: string) {
    return this.client.category.findFirst({
      where: { slug, ...this.notDeleted() },
    });
  }

  /** Todas as categorias ativas, sem paginação — para selects/dropdowns. */
  findAllActive() {
    return this.client.category.findMany({
      where: { ...this.notDeleted(), isActive: true },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    });
  }

  /** Retorna todos os mapeamentos de categorias para uma loja específica. */
  findStoreMappings(storeId: string) {
    return this.client.storeCategoryMap.findMany({
      where: { storeId },
    });
  }

  /** Raízes da árvore (sem parent). */
  findRoots() {
    return this.client.category.findMany({
      where: { ...this.notDeleted(), parentId: null },
      orderBy: [{ sortOrder: "asc" }],
      include: {
        children: {
          where: this.notDeleted(),
          orderBy: [{ sortOrder: "asc" }],
        },
      },
    });
  }

  /** Mapeamento loja→categoria interna. */
  findStoreMapping(storeId: string, externalCategoryId: string) {
    return this.client.storeCategoryMap.findUnique({
      where: { storeId_externalCategoryId: { storeId, externalCategoryId } },
      include: { category: true },
    });
  }

  /** Cria ou atualiza mapeamento de categoria externa. */
  async upsertStoreMapping(
    storeId: string,
    externalCategoryId: string,
    categoryId: string,
    externalPath?: string,
  ) {
    return this.client.storeCategoryMap.upsert({
      where: { storeId_externalCategoryId: { storeId, externalCategoryId } },
      create: { storeId, categoryId, externalCategoryId, externalPath },
      update: { categoryId, externalPath },
    });
  }
}

export const categoryRepository = new CategoryRepository(db as DbClient);
