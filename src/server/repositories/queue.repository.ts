import type { Prisma, QueueJob } from "@prisma/client";
import { firestore } from "@/server/firebase-admin";
import { BaseRepository, toPage } from "./base.repository";

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

function mapDocToJob(doc: any): QueueJob {
  const data = doc.data();
  return {
    id: stringToBigInt(doc.id),
    queue: data.queue,
    name: data.name,
    payload: data.payload ?? {},
    priority: data.priority ?? 100,
    attempts: data.attempts ?? 0,
    maxAttempts: data.maxAttempts ?? 3,
    status: data.status ?? "PENDING",
    availableAt: data.availableAt?.toDate() ?? new Date(),
    lockedAt: data.lockedAt?.toDate() ?? null,
    lockedBy: data.lockedBy ?? null,
    failedAt: data.failedAt?.toDate() ?? null,
    completedAt: data.completedAt?.toDate() ?? null,
    errorText: data.errorText ?? null,
    dedupeKey: data.dedupeKey ?? null,
    createdAt: data.createdAt?.toDate() ?? new Date(),
    updatedAt: data.updatedAt?.toDate() ?? new Date(),
  };
}

export class QueueRepository extends BaseRepository {
  withTransaction(tx: any) {
    return this;
  }

  async enqueue(input: {
    queue: string;
    name: string;
    payload: Prisma.InputJsonValue;
    priority?: number;
    availableAt?: Date;
    maxAttempts?: number;
    dedupeKey?: string;
  }): Promise<QueueJob> {
    const now = new Date();
    const id = firestore.collection("queue_jobs").doc().id;
    const docRef = firestore.collection("queue_jobs").doc(id);

    const jobData = {
      queue: input.queue,
      name: input.name,
      payload: input.payload,
      priority: input.priority ?? 100,
      attempts: 0,
      maxAttempts: input.maxAttempts ?? 3,
      status: "PENDING",
      availableAt: input.availableAt ?? now,
      lockedAt: null,
      lockedBy: null,
      failedAt: null,
      completedAt: null,
      errorText: null,
      dedupeKey: input.dedupeKey ?? null,
      createdAt: now,
      updatedAt: now,
    };

    if (input.dedupeKey) {
      const existing = await firestore
        .collection("queue_jobs")
        .where("queue", "==", input.queue)
        .where("dedupeKey", "==", input.dedupeKey)
        .where("status", "in", ["PENDING", "PROCESSING"])
        .limit(1)
        .get();

      if (!existing.empty) {
        return mapDocToJob(existing.docs[0]);
      }
    }

    await docRef.set(jobData);
    const createdDoc = await docRef.get();
    return mapDocToJob(createdDoc);
  }

  async dequeue(queue: string, workerId: string, limit = 1): Promise<QueueJob[]> {
    const now = new Date();
    const snapshot = await firestore
      .collection("queue_jobs")
      .where("queue", "==", queue)
      .where("status", "==", "PENDING")
      .get();

    let items = snapshot.docs.map((doc: any) => ({
      ref: doc.ref,
      docId: doc.id,
      data: doc.data(),
    }));

    items = items.filter((item: any) => {
      const avail = item.data.availableAt?.toDate();
      return avail && avail <= now;
    });

    items.sort((a: any, b: any) => {
      const priorityA = a.data.priority ?? 100;
      const priorityB = b.data.priority ?? 100;
      if (priorityA !== priorityB) return priorityA - priorityB;

      const availA = a.data.availableAt?.toDate()?.getTime() ?? 0;
      const availB = b.data.availableAt?.toDate()?.getTime() ?? 0;
      if (availA !== availB) return availA - availB;

      return a.docId.localeCompare(b.docId);
    });

    const candidates = items.slice(0, limit);
    const reservedJobs: QueueJob[] = [];

    for (const candidate of candidates) {
      try {
        const reserved = await firestore.runTransaction(async (transaction: any) => {
          const docSnapshot = await transaction.get(candidate.ref);
          if (!docSnapshot.exists) return null;

          const current = docSnapshot.data()!;
          if (current.status !== "PENDING") return null;

          const updateData = {
            status: "PROCESSING",
            lockedAt: now,
            lockedBy: workerId,
            attempts: (current.attempts ?? 0) + 1,
            updatedAt: now,
          };

          transaction.update(candidate.ref, updateData);
          return { id: docSnapshot.id, ...current, ...updateData };
        });

        if (reserved) {
          const mockDoc = {
            id: reserved.id,
            data: () => ({
              ...reserved,
              availableAt: { toDate: () => reserved.availableAt },
              lockedAt: { toDate: () => reserved.lockedAt },
              createdAt: { toDate: () => reserved.createdAt?.toDate ? reserved.createdAt.toDate() : new Date() },
              updatedAt: { toDate: () => reserved.updatedAt },
            }),
          };
          reservedJobs.push(mapDocToJob(mockDoc));
        }
      } catch (e) {
        // Ignora e continua
      }
    }

    return reservedJobs;
  }

  async complete(id: bigint | string): Promise<QueueJob> {
    const idStr = String(id);
    const docRef = firestore.collection("queue_jobs").doc(idStr);
    const now = new Date();

    await docRef.update({
      status: "COMPLETED",
      completedAt: now,
      lockedAt: null,
      lockedBy: null,
      errorText: null,
      updatedAt: now,
    });

    const updated = await docRef.get();
    return mapDocToJob(updated);
  }

  async retry(id: bigint | string, availableAt: Date, errorText: string): Promise<QueueJob> {
    const idStr = String(id);
    const docRef = firestore.collection("queue_jobs").doc(idStr);
    const now = new Date();

    await docRef.update({
      status: "PENDING",
      availableAt: new Date(availableAt),
      lockedAt: null,
      lockedBy: null,
      errorText,
      updatedAt: now,
    });

    const updated = await docRef.get();
    return mapDocToJob(updated);
  }

  async fail(id: bigint | string, errorText: string, dead: boolean): Promise<QueueJob> {
    const idStr = String(id);
    const docRef = firestore.collection("queue_jobs").doc(idStr);
    const now = new Date();

    await docRef.update({
      status: dead ? "DEAD" : "FAILED",
      failedAt: now,
      lockedAt: null,
      lockedBy: null,
      errorText,
      updatedAt: now,
    });

    const updated = await docRef.get();
    return mapDocToJob(updated);
  }

  async reclaimStale(staleMs: number): Promise<number> {
    const cutoff = new Date(Date.now() - staleMs);
    const snapshot = await firestore
      .collection("queue_jobs")
      .where("status", "==", "PROCESSING")
      .get();

    const jobs = snapshot.docs.filter((doc: any) => {
      const lockedAt = doc.data().lockedAt?.toDate();
      return lockedAt && lockedAt < cutoff;
    });

    if (jobs.length === 0) return 0;

    const batch = firestore.batch();
    const now = new Date();
    for (const job of jobs) {
      batch.update(job.ref, {
        status: "PENDING",
        lockedAt: null,
        lockedBy: null,
        updatedAt: now,
      });
    }

    await batch.commit();
    return jobs.length;
  }

  async stats(queue?: string) {
    let query: any = firestore.collection("queue_jobs");
    if (queue) {
      query = query.where("queue", "==", queue);
    }

    const snapshot = await query.get();
    const jobs = snapshot.docs.map((doc: any) => doc.data());

    const base: Record<string, number> = {
      PENDING: 0,
      PROCESSING: 0,
      COMPLETED: 0,
      FAILED: 0,
      DEAD: 0,
    };

    for (const job of jobs) {
      const status = job.status || "PENDING";
      base[status] = (base[status] || 0) + 1;
    }

    const pendingJobs = jobs.filter((j: any) => j.status === "PENDING");
    pendingJobs.sort((a: any, b: any) => {
      const availA = a.availableAt?.toDate()?.getTime() ?? 0;
      const availB = b.availableAt?.toDate()?.getTime() ?? 0;
      return availA - availB;
    });

    const oldest = pendingJobs[0];

    return {
      counts: base,
      depth: (base.PENDING ?? 0) + (base.PROCESSING ?? 0),
      oldestPendingAt: oldest?.availableAt?.toDate() ?? null,
    };
  }

  async findMany(filter: { queue?: string; status?: QueueJob["status"]; limit?: number }): Promise<QueueJob[]> {
    let query: any = firestore.collection("queue_jobs");
    if (filter.queue) {
      query = query.where("queue", "==", filter.queue);
    }
    if (filter.status) {
      query = query.where("status", "==", filter.status);
    }

    const snapshot = await query.get();
    const items = snapshot.docs.map(mapDocToJob);

    items.sort((a: QueueJob, b: QueueJob) => b.createdAt.getTime() - a.createdAt.getTime());
    return items.slice(0, filter.limit ?? 50);
  }

  async purgeCompleted(olderThan: Date): Promise<number> {
    const snapshot = await firestore
      .collection("queue_jobs")
      .where("status", "==", "COMPLETED")
      .get();

    const oldJobs = snapshot.docs.filter((doc: any) => {
      const completedAt = doc.data().completedAt?.toDate();
      return completedAt && completedAt < olderThan;
    });

    if (oldJobs.length === 0) return 0;

    const batch = firestore.batch();
    for (const job of oldJobs) {
      batch.delete(job.ref);
    }

    await batch.commit();
    return oldJobs.length;
  }
}

export const queueRepository = new QueueRepository();
