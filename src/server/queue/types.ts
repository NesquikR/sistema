import type { QueueJob } from "@prisma/client";

/** Filas nomeadas: isolam domínios para que um atraso não contamine o outro. */
export const QUEUES = {
  connectors: "connectors",
  analysis: "analysis",
  publishing: "publishing",
  maintenance: "maintenance",
  default: "default",
} as const;

export type QueueName = (typeof QUEUES)[keyof typeof QUEUES];

export interface JobContext {
  job: QueueJob;
  attempt: number;
  correlationId: string;
  signal: AbortSignal;
}

export type JobHandler<P = unknown> = (
  payload: P,
  ctx: JobContext,
) => Promise<JobResult | void>;

export interface JobResult {
  message?: string;
  data?: Record<string, unknown>;
}

export interface HandlerDefinition<P = unknown> {
  name: string;
  queue: QueueName;
  handler: JobHandler<P>;
  /** Teto de execução; ao estourar, o job é abortado e tratado como retryable. */
  timeoutMs?: number;
  maxAttempts?: number;
}

export interface EnqueueOptions {
  priority?: number;
  delayMs?: number;
  runAt?: Date;
  maxAttempts?: number;
  /** Chave única: enfileirar de novo com a mesma chave não duplica o job. */
  dedupeKey?: string;
}
