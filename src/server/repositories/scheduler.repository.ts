import type { ExecutionStatus, Prisma, SchedulerJob } from "@prisma/client";
import { firestore } from "@/server/firebase-admin";
import { BaseRepository } from "./base.repository";

function mapDocToJob(doc: any): SchedulerJob {
  const data = doc.data();
  return {
    id: doc.id,
    key: data.key,
    name: data.name,
    description: data.description ?? null,
    jobType: data.jobType ?? "CUSTOM",
    storeId: data.storeId ?? null,
    cronExpression: data.cronExpression,
    timezone: data.timezone ?? "America/Sao_Paulo",
    isEnabled: data.isEnabled ?? true,
    concurrencyLimit: data.concurrencyLimit ?? 1,
    timeoutSeconds: data.timeoutSeconds ?? 300,
    maxRetries: data.maxRetries ?? 3,
    backoffStrategy: data.backoffStrategy ?? "exponential",
    payload: data.payload ?? null,
    lastRunAt: data.lastRunAt?.toDate() ?? null,
    nextRunAt: data.nextRunAt?.toDate() ?? null,
    lastStatus: (data.lastStatus as ExecutionStatus) ?? null,
    runCount: data.runCount ?? 0,
    failureCount: data.failureCount ?? 0,
    createdAt: data.createdAt?.toDate() ?? new Date(),
    updatedAt: data.updatedAt?.toDate() ?? new Date(),
  };
}

export class SchedulerRepository extends BaseRepository {
  withTransaction(tx: any) {
    return this;
  }

  async findAll(): Promise<SchedulerJob[]> {
    const snapshot = await firestore.collection("scheduler_jobs").get();
    const items: SchedulerJob[] = snapshot.docs.map(mapDocToJob);
    items.sort((a: SchedulerJob, b: SchedulerJob) => a.key.localeCompare(b.key));
    return items;
  }

  async findByKey(key: string): Promise<SchedulerJob | null> {
    const doc = await firestore.collection("scheduler_jobs").doc(key).get();
    if (!doc.exists) return null;
    return mapDocToJob(doc);
  }

  async findDue(now: Date, limit = 20): Promise<SchedulerJob[]> {
    const snapshot = await firestore
      .collection("scheduler_jobs")
      .where("isEnabled", "==", true)
      .get();

    const items: SchedulerJob[] = snapshot.docs.map(mapDocToJob);
    
    const due = items.filter(
      (job: SchedulerJob) => !job.nextRunAt || job.nextRunAt <= now,
    );

    due.sort((a: SchedulerJob, b: SchedulerJob) => {
      const aTime = a.nextRunAt?.getTime() ?? 0;
      const bTime = b.nextRunAt?.getTime() ?? 0;
      return aTime - bTime;
    });

    return due.slice(0, limit);
  }

  async claim(id: string, expectedNextRunAt: Date | null, newNextRunAt: Date): Promise<boolean> {
    const docRef = firestore.collection("scheduler_jobs").doc(id);

    try {
      const claimed = await firestore.runTransaction(async (transaction: any) => {
        const docSnapshot = await transaction.get(docRef);
        if (!docSnapshot.exists) return false;

        const current = docSnapshot.data()!;
        if (current.isEnabled !== true) return false;

        const currentNextRun = current.nextRunAt?.toDate()?.getTime() ?? null;
        const expectedTime = expectedNextRunAt ? new Date(expectedNextRunAt).getTime() : null;

        if (currentNextRun !== expectedTime) return false;

        transaction.update(docRef, {
          nextRunAt: new Date(newNextRunAt),
          lastRunAt: new Date(),
          updatedAt: new Date(),
        });
        return true;
      });

      return claimed;
    } catch (e) {
      return false;
    }
  }

  async recordResult(id: string, status: ExecutionStatus): Promise<SchedulerJob> {
    const docRef = firestore.collection("scheduler_jobs").doc(id);

    const doc = await docRef.get();
    if (!doc.exists) {
      throw new Error(`SchedulerJob com ID ${id} não encontrado.`);
    }

    const current = doc.data()!;
    const isFailed = status === "FAILED" || status === "TIMEOUT";

    const updateData: Record<string, any> = {
      lastStatus: status,
      runCount: (current.runCount ?? 0) + 1,
      updatedAt: new Date(),
    };

    if (isFailed) {
      updateData.failureCount = (current.failureCount ?? 0) + 1;
    }

    await docRef.update(updateData);
    const updated = await docRef.get();
    return mapDocToJob(updated);
  }

  async setEnabled(key: string, isEnabled: boolean): Promise<SchedulerJob> {
    const docRef = firestore.collection("scheduler_jobs").doc(key);
    await docRef.update({ isEnabled, updatedAt: new Date() });
    
    const updated = await docRef.get();
    return mapDocToJob(updated);
  }

  async setNextRun(id: string, nextRunAt: Date): Promise<SchedulerJob> {
    const docRef = firestore.collection("scheduler_jobs").doc(id);
    await docRef.update({ nextRunAt: new Date(nextRunAt), updatedAt: new Date() });
    
    const updated = await docRef.get();
    return mapDocToJob(updated);
  }

  async upsert(data: Prisma.SchedulerJobCreateInput): Promise<SchedulerJob> {
    const key = data.key;
    const docRef = firestore.collection("scheduler_jobs").doc(key);

    const doc = await docRef.get();
    const now = new Date();

    const jobData: Record<string, any> = {
      key,
      name: data.name,
      cronExpression: data.cronExpression,
      updatedAt: now,
    };

    if (!doc.exists) {
      jobData.isEnabled = data.isEnabled ?? true;
      jobData.runCount = 0;
      jobData.failureCount = 0;
      jobData.createdAt = now;
      jobData.nextRunAt = data.nextRunAt ? new Date(data.nextRunAt as any) : null;
      await docRef.set(jobData);
    } else {
      await docRef.update(jobData);
    }

    const updated = await docRef.get();
    return mapDocToJob(updated);
  }
}

export const schedulerRepository = new SchedulerRepository();
