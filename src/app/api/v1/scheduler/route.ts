import type { NextRequest } from "next/server";
import { z } from "zod";
import { bootstrap } from "@/server/bootstrap";
import { NotFoundError } from "@/server/core/errors";
import { parseBody, withApiHandler } from "@/server/http/handler";
import { ok } from "@/server/http/responses";
import { schedulerRepository } from "@/server/repositories/scheduler.repository";
import { isValidCron, upcomingRuns } from "@/server/scheduler/cron";
import { scheduler } from "@/server/scheduler/scheduler";

import { processQueueSync } from "@/server/queue/worker";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const actionBody = z.discriminatedUnion("action", [
  z.object({ action: z.literal("run"), key: z.string().min(1) }),
  z.object({ action: z.literal("enable"), key: z.string().min(1) }),
  z.object({ action: z.literal("disable"), key: z.string().min(1) }),
  z.object({ action: z.literal("tick") }),
]);

/** GET /api/v1/scheduler — jobs ou disparo rápido de tick via query. */
export const GET = withApiHandler(async (request: NextRequest) => {
  await bootstrap("web");

  const searchParams = new URL(request.url).searchParams;
  if (searchParams.get("action") === "tick" || searchParams.get("tick") === "true") {
    const dispatched = await scheduler.tick();
    // Processa a fila de forma síncrona por até 8 segundos no ambiente serverless
    const processedJobs = await processQueueSync(8);
    return ok({ status: "success", dispatched, processedJobs });
  }

  const jobs = await schedulerRepository.findAll();

  return ok({
    status: scheduler.status,
    jobs: jobs.map((job) => ({
      ...job,
      cronValido: isValidCron(job.cronExpression, job.timezone),
      proximasExecucoes: isValidCron(job.cronExpression, job.timezone)
        ? upcomingRuns(job.cronExpression, 3, job.timezone)
        : [],
    })),
  });
}, { name: "GET /api/v1/scheduler" });

/** POST /api/v1/scheduler — disparo manual, habilitar/desabilitar, tick forçado. */
export const POST = withApiHandler(async (request: NextRequest) => {
  await bootstrap("web");
  const body = await parseBody(request, actionBody);

  switch (body.action) {
    case "tick": {
      const dispatched = await scheduler.tick();
      const processedJobs = await processQueueSync(8);
      return ok({ dispatched, processedJobs });
    }
    case "run": {
      const job = await scheduler.runNow(body.key);
      if (job === null) {
        const exists = await schedulerRepository.findByKey(body.key);
        if (!exists) throw new NotFoundError("Job do scheduler", body.key);
        return ok({
          enfileirado: false,
          motivo: "Job existe, mas ainda não há handler registrado para o seu tipo",
        });
      }
      return ok({ enfileirado: true, queueJobId: String(job.id) });
    }
    case "enable":
    case "disable": {
      const updated = await schedulerRepository.setEnabled(
        body.key,
        body.action === "enable",
      );
      return ok(updated);
    }
  }
}, { name: "POST /api/v1/scheduler" });
