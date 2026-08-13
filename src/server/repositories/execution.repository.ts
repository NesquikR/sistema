import type { ExecutionStatus, Prisma, TriggerType } from "@prisma/client";
import { db } from "@/server/db";
import { BaseRepository, toPage, type DbClient } from "./base.repository";

export class ExecutionRepository extends BaseRepository {
  withTransaction(tx: Prisma.TransactionClient) {
    return new ExecutionRepository(tx);
  }

  start(input: {
    jobId?: string;
    storeId?: string;
    parentExecutionId?: string;
    trigger?: TriggerType;
    correlationId?: string;
  }) {
    return this.client.execution.create({
      data: {
        jobId: input.jobId,
        storeId: input.storeId,
        parentExecutionId: input.parentExecutionId,
        trigger: input.trigger ?? "CRON",
        correlationId: input.correlationId,
        status: "RUNNING",
        startedAt: new Date(),
      },
    });
  }

  /** Encerramento em um único UPDATE — duração calculada aqui, não no banco. */
  finish(
    id: string,
    status: ExecutionStatus,
    patch: Prisma.ExecutionUpdateInput & { startedAt?: never } = {},
  ) {
    return this.client.execution.update({
      where: { id },
      data: {
        ...patch,
        status,
        finishedAt: new Date(),
      },
    });
  }

  async finishWithDuration(
    id: string,
    status: ExecutionStatus,
    startedAt: Date,
    patch: Prisma.ExecutionUpdateInput = {},
  ) {
    return this.client.execution.update({
      where: { id },
      data: {
        ...patch,
        status,
        finishedAt: new Date(),
        durationMs: Date.now() - startedAt.getTime(),
      },
    });
  }

  findById(id: string) {
    return this.client.execution.findUnique({
      where: { id },
      include: { steps: { orderBy: { sequence: "asc" } } },
    });
  }

  async findMany(filter: {
    jobId?: string;
    storeId?: string;
    status?: ExecutionStatus;
    limit?: number;
    offset?: number;
  }) {
    const { limit = 50, offset = 0 } = filter;
    const where: Prisma.ExecutionWhereInput = {
      ...(filter.jobId ? { jobId: filter.jobId } : {}),
      ...(filter.storeId ? { storeId: filter.storeId } : {}),
      ...(filter.status ? { status: filter.status } : {}),
    };

    const [items, total] = await Promise.all([
      this.client.execution.findMany({
        where,
        orderBy: { startedAt: "desc" },
        take: limit,
        skip: offset,
      }),
      this.client.execution.count({ where }),
    ]);

    return toPage(items, total, limit, offset);
  }

  addStep(input: {
    executionId: string;
    sequence: number;
    name: string;
    input?: Prisma.InputJsonValue;
  }) {
    return this.client.executionStep.create({
      data: {
        executionId: input.executionId,
        sequence: input.sequence,
        name: input.name,
        input: input.input,
        status: "RUNNING",
      },
    });
  }

  finishStep(
    id: string,
    status: "SUCCESS" | "FAILED" | "SKIPPED",
    patch: { output?: Prisma.InputJsonValue; errorText?: string; durationMs?: number } = {},
  ) {
    return this.client.executionStep.update({
      where: { id },
      data: { ...patch, status, finishedAt: new Date() },
    });
  }

  /** Execuções travadas em RUNNING além do timeout do job. */
  findStuck(olderThan: Date) {
    return this.client.execution.findMany({
      where: { status: "RUNNING", startedAt: { lt: olderThan } },
      take: 50,
    });
  }
}

export const executionRepository = new ExecutionRepository(db as DbClient);
