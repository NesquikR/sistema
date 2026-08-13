/**
 * Processo de background.
 *
 * Roda separado do servidor web (`npm run worker`). A separação é deliberada:
 * o ciclo de vida de um servidor Next.js é controlado pelo framework — ele
 * pode recriar módulos a cada hot reload, e em produção serverless nem sequer
 * mantém processo vivo entre requisições. Scheduler e workers precisam do
 * oposto: um processo longo, previsível e com shutdown controlado.
 *
 * Consequência prática: escalar o trabalho de background é subir mais desta
 * instância, sem tocar no servidor web.
 */
import "@/server/config/load-env";

import { loadEnv } from "@/server/config/env";
import { createLogger } from "@/server/core/logger";
import { bootstrap, shutdown } from "@/server/bootstrap";
import { QUEUES } from "@/server/queue/types";
import { reclaimStaleJobs, startWorkers, stopWorkers } from "@/server/queue/worker";
import { queueService } from "@/server/queue/queue.service";
import { scheduler } from "@/server/scheduler/scheduler";
import { executionService } from "@/server/services/execution.service";

const log = createLogger("runtime");

const MAINTENANCE_INTERVAL_MS = 60_000;
const STUCK_EXECUTION_MS = 30 * 60_000;
const COMPLETED_JOB_TTL_MS = 24 * 60 * 60_000;

async function main() {
  const env = loadEnv();
  await bootstrap("worker");

  if (env.QUEUE_ENABLED) {
    startWorkers([
      QUEUES.default,
      QUEUES.connectors,
      QUEUES.analysis,
      QUEUES.publishing,
      QUEUES.maintenance,
    ]);
  } else {
    log.warn("Workers desabilitados por configuração (QUEUE_ENABLED=false)");
  }

  if (env.SCHEDULER_ENABLED) {
    scheduler.start();
  } else {
    log.warn("Scheduler desabilitado por configuração (SCHEDULER_ENABLED=false)");
  }

  const maintenance = setInterval(() => void runMaintenance(), MAINTENANCE_INTERVAL_MS);

  const stop = async (signal: string) => {
    log.info("Sinal recebido", { signal });
    clearInterval(maintenance);
    scheduler.stop();
    await stopWorkers();
    await shutdown(signal);
    process.exit(0);
  };

  process.on("SIGINT", () => void stop("SIGINT"));
  process.on("SIGTERM", () => void stop("SIGTERM"));

  // Uma promise rejeitada sem tratamento derrubaria o processo em silêncio.
  process.on("unhandledRejection", (reason) => {
    log.fatal("Promise rejeitada sem tratamento", { error: reason });
  });
  process.on("uncaughtException", (error) => {
    log.fatal("Exceção não capturada", { error });
    void stop("uncaughtException");
  });

  log.success("Runtime de background em operação");
}

/** Rotinas de higiene que impedem o acúmulo silencioso de lixo. */
async function runMaintenance() {
  try {
    await reclaimStaleJobs();
    await executionService.reapStuck(STUCK_EXECUTION_MS);
    const purged = await queueService.purgeCompleted(COMPLETED_JOB_TTL_MS);
    if (purged) log.debug("Jobs concluídos removidos", { total: purged });
  } catch (e) {
    log.error("Falha na rotina de manutenção", { error: e });
  }
}

main().catch((e) => {
  log.fatal("Falha ao iniciar o runtime", { error: e });
  process.exit(1);
});
