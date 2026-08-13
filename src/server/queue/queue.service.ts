import type { Prisma } from "@prisma/client";
import { createLogger } from "@/server/core/logger";
import { ConflictError } from "@/server/core/errors";
import { queueRepository } from "@/server/repositories/queue.repository";
import { handlerRegistry } from "./handlers";
import { QUEUES, type EnqueueOptions, type QueueName } from "./types";

const log = createLogger("queue");

/**
 * API de enfileiramento.
 *
 * `enqueue` valida o nome contra o registro de handlers **na hora de
 * enfileirar**. Descobrir que um job não tem handler no momento em que ele
 * seria executado — possivelmente horas depois, num worker — é tarde demais.
 */
export class QueueService {
  async enqueue(
    name: string,
    payload: Prisma.InputJsonValue = {},
    options: EnqueueOptions = {},
  ) {
    const definition = handlerRegistry.get(name);

    const availableAt =
      options.runAt ??
      (options.delayMs ? new Date(Date.now() + options.delayMs) : new Date());

    try {
      const job = await queueRepository.enqueue({
        queue: definition.queue,
        name,
        payload,
        priority: options.priority,
        availableAt,
        maxAttempts: options.maxAttempts ?? definition.maxAttempts ?? 3,
        dedupeKey: options.dedupeKey,
      });

      log.debug("Job enfileirado", {
        id: String(job.id),
        name,
        queue: definition.queue,
        availableAt: availableAt.toISOString(),
      });

      return job;
    } catch (e) {
      // Violação de unicidade em dedupeKey: o job já está na fila.
      if (
        options.dedupeKey &&
        typeof e === "object" &&
        e !== null &&
        (e as { code?: string }).code === "P2002"
      ) {
        throw new ConflictError("Job já enfileirado", {
          dedupeKey: options.dedupeKey,
        });
      }
      throw e;
    }
  }

  /** Enfileira ignorando silenciosamente a duplicata. */
  async enqueueOnce(
    name: string,
    payload: Prisma.InputJsonValue,
    dedupeKey: string,
    options: Omit<EnqueueOptions, "dedupeKey"> = {},
  ) {
    try {
      return await this.enqueue(name, payload, { ...options, dedupeKey });
    } catch (e) {
      if (e instanceof ConflictError) {
        log.trace("Job duplicado ignorado", { name, dedupeKey });
        return null;
      }
      throw e;
    }
  }

  stats(queue?: QueueName) {
    return queueRepository.stats(queue);
  }

  async statsAll() {
    const entries = await Promise.all(
      Object.values(QUEUES).map(async (q) => [q, await queueRepository.stats(q)] as const),
    );
    return Object.fromEntries(entries);
  }

  list(filter: { queue?: QueueName; status?: Parameters<typeof queueRepository.findMany>[0]["status"]; limit?: number }) {
    return queueRepository.findMany(filter);
  }

  purgeCompleted(olderThanMs: number) {
    return queueRepository.purgeCompleted(new Date(Date.now() - olderThanMs));
  }
}

export const queueService = new QueueService();
