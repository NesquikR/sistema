import type { SchedulerJob } from "@prisma/client";
import { loadEnv } from "@/server/config/env";
import { newCorrelationId, runWithContext } from "@/server/core/context";
import { normalizeError } from "@/server/core/errors";
import { createLogger } from "@/server/core/logger";
import { schedulerRepository } from "@/server/repositories/scheduler.repository";
import { queueService } from "@/server/queue/queue.service";
import { handlerRegistry } from "@/server/queue/handlers";
import { nextRunAt } from "./cron";

const log = createLogger("scheduler");

/**
 * Scheduler.
 *
 * Não executa trabalho: a cada tick, verifica quais jobs venceram e **enfileira**
 * o handler correspondente. Essa separação é deliberada — um job pesado rodando
 * dentro do tick atrasaria todos os outros, e o scheduler perderia a noção de
 * tempo justamente quando o sistema está sob carga.
 *
 * A reivindicação é atômica via `UPDATE ... WHERE nextRunAt = <valor lido>`, o
 * que garante um único disparo mesmo com vários processos rodando.
 *
 * O mapa job → handler é declarado aqui e permanece vazio de regra de negócio:
 * cada módulo futuro registra o seu handler e passa a ser agendável sem que
 * este arquivo mude.
 */

/** JobType do banco → nome do handler de fila. */
const JOB_HANDLERS: Record<string, string> = {
  STORE_SYNC: "connectors.sync-stores-master",
  AI_EVALUATION: "ai.evaluate-batch",
  PUBLISH_QUEUE: "publishing.process-queue",
  PRICE_STATS: "pricing.recompute-all",
  ANALYTICS_ROLLUP: "analytics.rollup-all",
  COUPON_VERIFY: "coupons.verify-all",
  HEALTH_CHECK: "health.check-all",
  RETENTION_CLEANUP: "system.noop", // O worker já executa limpeza na rotina de manutenção do runtime
};

export class Scheduler {
  private timer: NodeJS.Timeout | null = null;
  private running = false;
  private ticking = false;
  private lastTickAt: Date | null = null;
  private tickCount = 0;

  start() {
    if (this.running) return;
    const env = loadEnv();
    this.running = true;

    log.info("Scheduler iniciado", { intervaloMs: env.SCHEDULER_TICK_MS });
    void this.tick();
    this.timer = setInterval(() => void this.tick(), env.SCHEDULER_TICK_MS);
  }

  stop() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    this.running = false;
    log.info("Scheduler encerrado");
  }

  get status() {
    return {
      running: this.running,
      ticking: this.ticking,
      lastTickAt: this.lastTickAt,
      tickCount: this.tickCount,
      mappedHandlers: Object.keys(JOB_HANDLERS).length,
    };
  }

  /** Um ciclo de verificação. Reentrância é bloqueada por `ticking`. */
  async tick(): Promise<number> {
    if (this.ticking) {
      log.debug("Tick anterior ainda em andamento — ignorado");
      return 0;
    }

    this.ticking = true;
    const now = new Date();
    let dispatched = 0;

    try {
      const due = await schedulerRepository.findDue(now);
      for (const job of due) {
        if (await this.dispatch(job, now)) dispatched++;
      }

      this.lastTickAt = now;
      this.tickCount++;
      if (dispatched) log.info("Jobs disparados", { total: dispatched });
    } catch (e) {
      log.error("Falha no tick do scheduler", { error: e });
    } finally {
      this.ticking = false;
    }

    return dispatched;
  }

  /** Dispara um job manualmente, ignorando o cron. */
  async runNow(key: string) {
    const job = await schedulerRepository.findByKey(key);
    if (!job) return null;
    return this.enqueueFor(job, "MANUAL");
  }

  // -------------------------------------------------------------------------

  private async dispatch(job: SchedulerJob, now: Date): Promise<boolean> {
    let computedNext: Date;
    try {
      computedNext = nextRunAt(job.cronExpression, job.timezone, now);
    } catch (e) {
      log.error("Job com cron inválido foi desabilitado", {
        key: job.key,
        cron: job.cronExpression,
        error: e,
      });
      await schedulerRepository.setEnabled(job.key, false);
      return false;
    }

    // Reivindicação atômica: só um processo vence.
    const claimed = await schedulerRepository.claim(job.id, job.nextRunAt, computedNext);
    if (!claimed) {
      log.trace("Job já reivindicado por outro processo", { key: job.key });
      return false;
    }

    await this.enqueueFor(job, "CRON");
    return true;
  }

  private async enqueueFor(job: SchedulerJob, trigger: "CRON" | "MANUAL") {
    const correlationId = newCorrelationId();

    return runWithContext({ source: "scheduler", correlationId }, async () => {
      const handlerName = JOB_HANDLERS[job.jobType];

      if (!handlerName || !handlerRegistry.has(handlerName)) {
        // Estado esperado nesta fase: os jobs existem, os módulos ainda não.
        log.debug("Job sem handler registrado — nada a executar", {
          key: job.key,
          jobType: job.jobType,
        });
        return null;
      }

      try {
        const queued = await queueService.enqueue(
          handlerName,
          { schedulerJobId: job.id, jobKey: job.key, storeId: job.storeId, trigger },
          { maxAttempts: job.maxRetries },
        );
        log.info("Job enfileirado pelo scheduler", {
          key: job.key,
          handler: handlerName,
          queueJobId: String(queued.id),
        });
        return queued;
      } catch (e) {
        log.error("Falha ao enfileirar job do scheduler", {
          key: job.key,
          error: normalizeError(e),
        });
        return null;
      }
    });
  }
}

export const scheduler = new Scheduler();

/** Registra o handler que atende um `JobType` do banco. */
export function mapJobTypeToHandler(jobType: string, handlerName: string) {
  JOB_HANDLERS[jobType] = handlerName;
}
