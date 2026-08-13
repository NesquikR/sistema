import { type LogLevel, type Prisma, type Log } from "@prisma/client";
import { firestore } from "@/server/firebase-admin";
import { BaseRepository, toPage, type Page } from "./base.repository";

function stringToBigInt(str: string): bigint {
  try {
    if (/^\d+$/.test(str)) {
      return BigInt(str);
    }
    let hash = 0n;
    for (let i = 0; i < str.length; i++) {
      hash = BigInt(str.charCodeAt(i)) + (hash << 5n) - hash;
    }
    return hash < 0n ? -hash : hash;
  } catch {
    return 0n;
  }
}

function mapDocToLog(doc: any): Log {
  const data = doc.data();
  return {
    id: stringToBigInt(doc.id),
    level: data.level ?? "INFO",
    source: data.source,
    message: data.message,
    context: data.context ?? null,
    executionId: data.executionId ?? null,
    storeId: data.storeId ?? null,
    offerId: data.offerId ?? null,
    correlationId: data.correlationId ?? null,
    durationMs: data.durationMs ?? null,
    errorStack: data.errorStack ?? null,
    createdAt: data.createdAt?.toDate() ?? new Date(),
  };
}

export class LogRepository extends BaseRepository {
  withTransaction(tx: any) {
    return this;
  }

  async createMany(entries: Prisma.LogCreateManyInput[]) {
    if (!entries.length) return { count: 0 };

    const batch = firestore.batch();
    for (const entry of entries) {
      const logId = firestore.collection("logs").doc().id;
      const logRef = firestore.collection("logs").doc(logId);
      batch.set(logRef, {
        level: entry.level,
        message: entry.message,
        source: entry.source,
        context: entry.context ?? null,
        executionId: entry.executionId ?? null,
        storeId: entry.storeId ?? null,
        offerId: entry.offerId ?? null,
        correlationId: entry.correlationId ?? null,
        durationMs: entry.durationMs ?? null,
        errorStack: entry.errorStack ?? null,
        createdAt: entry.createdAt ? new Date(entry.createdAt as any) : new Date(),
      });
    }

    await batch.commit();
    return { count: entries.length };
  }

  async findMany(filter: {
    level?: LogLevel;
    levels?: LogLevel[];
    source?: string;
    search?: string;
    correlationId?: string;
    executionId?: string;
    since?: Date;
    limit?: number;
    offset?: number;
  }): Promise<Page<Log>> {
    const { limit = 100, offset = 0 } = filter;

    let query: any = firestore.collection("logs");

    if (filter.level) {
      query = query.where("level", "==", filter.level);
    }
    if (filter.correlationId) {
      query = query.where("correlationId", "==", filter.correlationId);
    }
    if (filter.executionId) {
      query = query.where("executionId", "==", filter.executionId);
    }
    if (filter.since) {
      query = query.where("createdAt", ">=", filter.since);
    }

    const snapshot = await query.get();
    let items: Log[] = snapshot.docs.map(mapDocToLog);

    if (filter.levels && filter.levels.length > 0) {
      items = items.filter((log: Log) => filter.levels!.includes(log.level as LogLevel));
    }
    if (filter.source) {
      const sourceLower = filter.source.toLowerCase();
      items = items.filter((log: Log) => log.source.toLowerCase().includes(sourceLower));
    }
    if (filter.search) {
      const searchLower = filter.search.toLowerCase();
      items = items.filter((log: Log) => log.message.toLowerCase().includes(searchLower));
    }

    items.sort((a: Log, b: Log) => b.createdAt.getTime() - a.createdAt.getTime());

    const total = items.length;
    const pagedItems = items.slice(offset, offset + limit);

    return toPage(pagedItems, total, limit, offset);
  }

  async countByLevel(since: Date) {
    const snapshot = await firestore
      .collection("logs")
      .where("createdAt", ">=", since)
      .get();
    
    const logs = snapshot.docs.map(mapDocToLog);
    const counts: Record<string, number> = {};

    for (const log of logs) {
      counts[log.level] = (counts[log.level] || 0) + 1;
    }

    return Object.entries(counts).map(([level, count]) => ({
      level: level as LogLevel,
      _count: { _all: count },
    }));
  }

  async purge(before: Date, levels?: LogLevel[]): Promise<number> {
    const snapshot = await firestore
      .collection("logs")
      .where("createdAt", "<", before)
      .get();

    let docsToDelete = snapshot.docs;

    if (levels && levels.length > 0) {
      docsToDelete = docsToDelete.filter((doc: any) =>
        levels.includes(doc.data().level as LogLevel),
      );
    }

    if (docsToDelete.length === 0) return 0;

    const chunks = [];
    const chunkSize = 500;
    for (let i = 0; i < docsToDelete.length; i += chunkSize) {
      chunks.push(docsToDelete.slice(i, i + chunkSize));
    }

    for (const chunk of chunks) {
      const batch = firestore.batch();
      for (const doc of chunk) {
        batch.delete(doc.ref);
      }
      await batch.commit();
    }

    return docsToDelete.length;
  }
}

export const logRepository = new LogRepository();
