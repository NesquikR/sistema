import type { Prisma, SettingScope } from "@prisma/client";
import { NotFoundError } from "@/server/core/errors";
import { createLogger } from "@/server/core/logger";
import { db } from "@/server/db";
import {
  GLOBAL_SCOPE_ID,
  settingRepository,
} from "@/server/repositories/setting.repository";

const log = createLogger("services.setting");

/**
 * Serviço de configurações.
 *
 * Duas responsabilidades que não podem ficar na rota nem no repositório:
 *
 *   1. **Cache em memória com TTL curto.** Configuração é lida em quase todo
 *      job; ir ao banco toda vez seria desperdício. O TTL de 30 s é o
 *      compromisso: mudanças pela interface valem quase imediatamente, sem
 *      exigir invalidação distribuída.
 *   2. **Histórico junto da escrita, na mesma transação.** Se a gravação e o
 *      histórico fossem operações separadas, uma falha entre as duas deixaria
 *      uma mudança sem trilha — exatamente a que alguém vai querer investigar.
 */
const CACHE_TTL_MS = 30_000;

interface CacheEntry {
  value: unknown;
  expiresAt: number;
}

export class SettingService {
  private cache = new Map<string, CacheEntry>();

  private cacheKey(key: string, scope: SettingScope, scopeId: string) {
    return `${scope}:${scopeId}:${key}`;
  }

  async get<T = unknown>(
    key: string,
    fallback: T,
    scope: SettingScope = "GLOBAL",
    scopeId = GLOBAL_SCOPE_ID,
  ): Promise<T> {
    const cacheKey = this.cacheKey(key, scope, scopeId);
    const cached = this.cache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) return cached.value as T;

    const row = await settingRepository.findOne(key, scope, scopeId);
    const value = (row?.value ?? fallback) as T;

    this.cache.set(cacheKey, { value, expiresAt: Date.now() + CACHE_TTL_MS });
    return value;
  }

  /** Resolve pela cadeia de escopos: o mais específico vence. */
  async resolve<T = unknown>(
    key: string,
    fallback: T,
    chain: { scope: SettingScope; scopeId: string }[],
  ): Promise<T> {
    const row = await settingRepository.resolve(key, chain);
    return (row?.value ?? fallback) as T;
  }

  list(scope?: SettingScope) {
    return settingRepository.findAll(scope);
  }

  async getOne(key: string, scope: SettingScope = "GLOBAL", scopeId = GLOBAL_SCOPE_ID) {
    const row = await settingRepository.findOne(key, scope, scopeId);
    if (!row) throw new NotFoundError("Configuração", key);
    return row;
  }

  async set(input: {
    key: string;
    value: Prisma.InputJsonValue;
    scope?: SettingScope;
    scopeId?: string;
    valueType?: Parameters<typeof settingRepository.upsert>[0]["valueType"];
    description?: string;
    updatedByUserId?: string;
    reason?: string;
  }) {
    const scope = input.scope ?? "GLOBAL";
    const scopeId = input.scopeId ?? GLOBAL_SCOPE_ID;

    const result = await db.$transaction(async (tx) => {
      const repo = settingRepository.withTransaction(tx);
      const previous = await repo.findOne(input.key, scope, scopeId);

      const saved = await repo.upsert({
        key: input.key,
        scope,
        scopeId,
        value: input.value,
        valueType: input.valueType,
        description: input.description,
        updatedByUserId: input.updatedByUserId,
      });

      await repo.recordHistory({
        settingId: saved.id,
        oldValue: (previous?.value ?? undefined) as Prisma.InputJsonValue | undefined,
        newValue: input.value,
        changedByUserId: input.updatedByUserId,
        reason: input.reason,
      });

      if (input.key === "categories_config" && Array.isArray(input.value)) {
        const categoriesList = input.value as any[];
        
        // 1. Marcar como deletadas as categorias do banco que não estão no novo JSON
        const incomingSlugs = categoriesList.map(c => c.id);
        await tx.category.updateMany({
          where: {
            slug: { notIn: incomingSlugs },
            deletedAt: null
          },
          data: {
            deletedAt: new Date(),
            isActive: false
          }
        });

        // 2. Upsert para cada categoria recebida
        for (let i = 0; i < categoriesList.length; i++) {
          const c = categoriesList[i];
          const slug = c.id;
          const name = c.name;
          const emoji = c.emoji || null;
          const accentColor = c.accent || null;
          const minDiscountPercent = Number(c.minDiscount ?? 30);
          const isActive = c.active !== false;

          await tx.category.upsert({
            where: { slug },
            update: {
              name,
              emoji,
              accentColor,
              minDiscountPercent,
              isActive,
              deletedAt: null,
              sortOrder: i,
            },
            create: {
              slug,
              name,
              emoji,
              accentColor,
              minDiscountPercent,
              isActive,
              path: `/${slug}`,
              depth: 0,
              sortOrder: i,
            }
          });
        }
      }

      return saved;
    });

    this.cache.delete(this.cacheKey(input.key, scope, scopeId));
    log.info("Configuração alterada", { key: input.key, scope });

    return result;
  }

  history(settingId: string, limit?: number) {
    return settingRepository.history(settingId, limit);
  }

  invalidateCache() {
    this.cache.clear();
  }

  get cacheSize() {
    return this.cache.size;
  }
}

export const settingService = new SettingService();
