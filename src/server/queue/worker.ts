import { randomUUID } from "node:crypto";
import type { QueueJob } from "@prisma/client";
import { loadEnv } from "@/server/config/env";
import { runWithContext } from "@/server/core/context";
import { normalizeError, TimeoutError } from "@/server/core/errors";
import { createLogger } from "@/server/core/logger";
import { queueRepository } from "@/server/repositories/queue.repository";
import { handlerRegistry } from "./handlers";
import type { QueueName } from "./types";

const log = createLogger("queue.worker");

/**
 * Worker de fila.
 *
 * Consome jobs de uma fila com concorrência limitada. Pontos que definem o
 * comportamento:
 *
 *   · **Backoff exponencial com jitter.** Sem o jitter, todos os jobs que
 *     falharam junto (uma loja fora do ar) voltariam juntos e derrubariam o
 *     parceiro de novo — o "thundering herd".
 *   · **Só erro `retryable` volta para a fila.** Payload inválido não melhora
 *     na terceira tentativa; timeout de rede, sim.
 *   · **Timeout via AbortSignal.** O handler recebe o sinal e pode encerrar
 *     sozinho; sem isso, um job travado seguraria um slot para sempre.
 *   · **Shutdown gracioso.** Ao receber SIGTERM, para de puxar jobs novos e
 *     espera os em andamento — matar um job no meio deixa estado inconsistente.
 */
export class QueueWorker {
  readonly id: string;
  private running = false;
  private stopping = false;
  private active = 0;
  private timer: NodeJS.Timeout | null = null;
  private idleSince = Date.now();
  /** Falhas consecutivas ao consultar a fila (banco fora, tipicamente). */
  private pollFailures = 0;

  constructor(
    private readonly queue: QueueName,
    private readonly concurrency = 4,
    private readonly pollMs = 2000,
  ) {
    this.id = `${queue}-${randomUUID().slice(0, 8)}`;
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.stopping = false;
    log.info("Worker iniciado", {
      worker: this.id,
      queue: this.queue,
      concurrency: this.concurrency,
    });
    void this.loop();
  }

  async stop(timeoutMs = 30_000) {
    if (!this.running) return;
    this.stopping = true;
    if (this.timer) clearTimeout(this.timer);

    const deadline = Date.now() + timeoutMs;
    while (this.active > 0 && Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, 100));
    }

    this.running = false;
    log.info("Worker encerrado", { worker: this.id, pendentes: this.active });
  }

  get status() {
    return {
      id: this.id,
      queue: this.queue,
      running: this.running,
      active: this.active,
      concurrency: this.concurrency,
      idleForMs: this.active === 0 ? Date.now() - this.idleSince : 0,
    };
  }

  // -------------------------------------------------------------------------

  private schedule(delay = this.pollMs) {
    if (this.stopping) return;
    this.timer = setTimeout(() => void this.loop(), delay);
  }

  private async loop() {
    if (this.stopping) return;

    const slots = this.concurrency - this.active;
    if (slots <= 0) return this.schedule(200);

    let jobs: QueueJob[] = [];
    try {
      jobs = await queueRepository.dequeue(this.queue, this.id, slots);
    } catch (e) {
      // Banco indisponível não pode matar o worker: recua e tenta de novo.
      //
      // O log é suprimido depois da primeira falha e só reaparece a cada 10
      // tentativas. Sem isso, uma indisponibilidade de poucos minutos gera
      // milhares de stack traces idênticos — e o log que deveria explicar o
      // incidente vira justamente o que impede de enxergá-lo.
      this.pollFailures++;
      const first = this.pollFailures === 1;

      if (first || this.pollFailures % 10 === 0) {
        log.error("Falha ao consultar a fila", {
          worker: this.id,
          falhasConsecutivas: this.pollFailures,
          ...(first ? { error: e } : {}),
        });
      }

      // 3s, 6s, 12s… até o teto de 1 min.
      const delay = Math.min(this.pollMs * 3 * 2 ** (this.pollFailures - 1), 60_000);
      return this.schedule(delay);
    }

    if (this.pollFailures > 0) {
      log.success("Conexão com a fila restabelecida", {
        worker: this.id,
        apósFalhas: this.pollFailures,
      });
      this.pollFailures = 0;
    }

    if (!jobs.length) {
      this.idleSince = Date.now();
      return this.schedule();
    }

    for (const job of jobs) {
      this.active++;
      void this.execute(job).finally(() => {
        this.active--;
      });
    }

    // Havia trabalho: volta imediatamente, pode haver mais.
    this.schedule(0);
  }

  private async execute(job: QueueJob) {
    const correlationId = randomUUID();
    const started = Date.now();

    await runWithContext({ source: "queue", correlationId, jobId: String(job.id) }, async () => {
      const controller = new AbortController();
      let timer: NodeJS.Timeout | undefined;

      try {
        const definition = handlerRegistry.get(job.name);
        const timeoutMs = definition.timeoutMs ?? 60_000;

        timer = setTimeout(() => controller.abort(), timeoutMs);

        const result = await Promise.race([
          definition.handler(job.payload as never, {
            job,
            attempt: job.attempts,
            correlationId,
            signal: controller.signal,
          }),
          new Promise<never>((_, reject) => {
            controller.signal.addEventListener("abort", () =>
              reject(new TimeoutError(`Job excedeu ${timeoutMs}ms`)),
            );
          }),
        ]);

        await queueRepository.complete(job.id);

        log.success("Job concluído", {
          id: String(job.id),
          name: job.name,
          attempt: job.attempts,
          durationMs: Date.now() - started,
          ...(result && "message" in result ? { resultado: result.message } : {}),
        });
      } catch (e) {
        await this.handleFailure(job, e, Date.now() - started);
      } finally {
        if (timer) clearTimeout(timer);
      }
    });
  }

  private async handleFailure(job: QueueJob, error: unknown, durationMs: number) {
    const err = normalizeError(error);
    const exhausted = job.attempts >= job.maxAttempts;
    const canRetry = err.retryable && !exhausted;

    try {
      if (canRetry) {
        const delay = this.backoff(job.attempts);
        await queueRepository.retry(job.id, new Date(Date.now() + delay), err.message);
        log.warn("Job reenfileirado", {
          id: String(job.id),
          name: job.name,
          attempt: job.attempts,
          proximaTentativaEmMs: delay,
          durationMs,
          error: err,
        });
      } else {
        await queueRepository.fail(job.id, err.message, exhausted || !err.retryable);
        log.error("Job descartado", {
          id: String(job.id),
          name: job.name,
          attempt: job.attempts,
          motivo: exhausted ? "tentativas esgotadas" : "erro não recuperável",
          durationMs,
          error: err,
        });
      }
    } catch (persistError) {
      log.error("Falha ao registrar resultado do job", {
        id: String(job.id),
        error: persistError,
      });
    }
  }

  /** 2^n segundos, teto de 5 min, ±20% de jitter. */
  private backoff(attempt: number): number {
    const base = Math.min(2 ** attempt * 1000, 300_000);
    const jitter = base * 0.2 * (Math.random() * 2 - 1);
    return Math.round(base + jitter);
  }
}

// ---------------------------------------------------------------------------

const workers = new Map<QueueName, QueueWorker>();

export function startWorkers(queues: QueueName[]) {
  const env = loadEnv();
  for (const queue of queues) {
    if (workers.has(queue)) continue;
    const worker = new QueueWorker(queue, env.QUEUE_CONCURRENCY, env.QUEUE_POLL_MS);
    worker.start();
    workers.set(queue, worker);
  }
  return [...workers.values()];
}

export async function stopWorkers() {
  await Promise.all([...workers.values()].map((w) => w.stop()));
  workers.clear();
}

export function workerStatus() {
  return [...workers.values()].map((w) => w.status);
}

/** Devolve jobs cujo worker morreu sem soltar o lock. */
export async function reclaimStaleJobs() {
  const env = loadEnv();
  const count = await queueRepository.reclaimStale(env.QUEUE_STALE_LOCK_MS);
  if (count > 0) log.warn("Jobs travados devolvidos à fila", { count });
  return count;
}

/** Execução síncrona da fila adaptada para ambientes serverless (Netlify/Vercel) */
export async function processQueueSync(maxSeconds = 8) {
  const started = Date.now();
  const deadline = started + maxSeconds * 1000;
  const queues: QueueName[] = ["connectors", "analysis", "publishing", "maintenance", "default"];
  let processedCount = 0;

  while (Date.now() < deadline) {
    let hadWork = false;

    for (const queue of queues) {
      // Evita estourar o limite de tempo no loop
      if (Date.now() >= deadline - 500) break;

      const jobs = await queueRepository.dequeue(queue, `sync-worker-${randomUUID().slice(0, 8)}`, 1);
      if (jobs.length > 0) {
        hadWork = true;
        const job = jobs[0];
        const correlationId = randomUUID();
        const jobStarted = Date.now();

        await runWithContext({ source: "queue", correlationId, jobId: String(job.id) }, async () => {
          const controller = new AbortController();
          let timer: NodeJS.Timeout | undefined;

          try {
            const definition = handlerRegistry.get(job.name);
            const remainingMs = deadline - Date.now();
            const timeoutMs = Math.min(definition.timeoutMs ?? 60_000, remainingMs);

            timer = setTimeout(() => controller.abort(), timeoutMs);

            const result = await Promise.race([
              definition.handler(job.payload as never, {
                job,
                attempt: job.attempts,
                correlationId,
                signal: controller.signal,
              }),
              new Promise<never>((_, reject) => {
                controller.signal.addEventListener("abort", () =>
                  reject(new TimeoutError(`Job excedeu ${timeoutMs}ms`)),
                );
              }),
            ]);

            await queueRepository.complete(job.id);
            processedCount++;

            log.success("Sync Job concluído", {
              id: String(job.id),
              name: job.name,
              attempt: job.attempts,
              durationMs: Date.now() - jobStarted,
              ...(result && typeof result === "object" && "message" in result ? { resultado: (result as any).message } : {}),
            });
          } catch (e) {
            const err = normalizeError(e);
            const exhausted = job.attempts >= job.maxAttempts;
            const canRetry = err.retryable && !exhausted;

            if (canRetry) {
              await queueRepository.retry(job.id, new Date(Date.now() + 2000), err.message);
            } else {
              await queueRepository.fail(job.id, err.message, exhausted || !err.retryable);
            }

            log.warn("Falha ao rodar Sync Job", {
              id: String(job.id),
              name: job.name,
              error: err.message,
            });
          } finally {
            if (timer) clearTimeout(timer);
          }
        });
      }
    }

    if (!hadWork) break;
  }

  return processedCount;
}
