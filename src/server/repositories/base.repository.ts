import type { Prisma, PrismaClient } from "@prisma/client";
import { db } from "@/server/db";

/**
 * Base dos repositórios.
 *
 * A camada de repositório é o **único** lugar do sistema que conhece o Prisma.
 * Services falam com repositórios; rotas falam com services. Isso mantém a
 * regra de negócio testável sem banco e concentra num só ponto qualquer troca
 * futura de ORM.
 *
 * `tx` permite que um repositório participe de uma transação iniciada por um
 * service, sem que o service precise saber como o repositório acessa o banco.
 */
export type DbClient = PrismaClient | Prisma.TransactionClient;

export abstract class BaseRepository {
  constructor(protected readonly client: DbClient = db) {}

  /** Devolve uma instância do repositório ligada a uma transação. */
  abstract withTransaction(tx: Prisma.TransactionClient): BaseRepository;
}

export interface Page<T> {
  items: T[];
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
}

export function toPage<T>(
  items: T[],
  total: number,
  limit: number,
  offset: number,
): Page<T> {
  return {
    items,
    total,
    limit,
    offset,
    hasMore: offset + items.length < total,
  };
}
