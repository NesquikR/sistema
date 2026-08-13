import type { NextRequest } from "next/server";
import { z } from "zod";
import { bootstrap } from "@/server/bootstrap";
import { parseBody, parseQuery, withApiHandler } from "@/server/http/handler";
import { created, ok } from "@/server/http/responses";
import { handlerRegistry } from "@/server/queue/handlers";
import { queueService } from "@/server/queue/queue.service";
import { workerStatus } from "@/server/queue/worker";
import { QUEUES } from "@/server/queue/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const queueEnum = z.enum([
  QUEUES.default,
  QUEUES.connectors,
  QUEUES.analysis,
  QUEUES.publishing,
  QUEUES.maintenance,
]);

const listQuery = z.object({
  queue: queueEnum.optional(),
  status: z
    .enum(["PENDING", "RESERVED", "PROCESSING", "COMPLETED", "FAILED", "DEAD"])
    .optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});

const enqueueBody = z.object({
  name: z.string().min(2).max(120),
  payload: z.record(z.string(), z.unknown()).default({}),
  priority: z.number().int().min(1).max(1000).optional(),
  delayMs: z.number().int().min(0).max(86_400_000).optional(),
  maxAttempts: z.number().int().min(1).max(10).optional(),
  dedupeKey: z.string().max(200).optional(),
});

/** GET /api/v1/queue — estatísticas, workers e jobs recentes. */
export const GET = withApiHandler(async (request: NextRequest) => {
  await bootstrap("web");
  const query = parseQuery(request, listQuery);

  const [stats, jobs] = await Promise.all([
    queueService.statsAll(),
    queueService.list({ queue: query.queue, status: query.status, limit: query.limit }),
  ]);

  return ok({
    stats,
    workers: workerStatus(),
    handlers: handlerRegistry.list(),
    jobs: jobs.map((j) => ({ ...j, id: String(j.id) })),
  });
}, { name: "GET /api/v1/queue" });

/** POST /api/v1/queue — enfileira um job pelo nome do handler. */
export const POST = withApiHandler(async (request: NextRequest) => {
  await bootstrap("web");
  const body = await parseBody(request, enqueueBody);

  const job = await queueService.enqueue(body.name, body.payload as never, {
    priority: body.priority,
    delayMs: body.delayMs,
    maxAttempts: body.maxAttempts,
    dedupeKey: body.dedupeKey,
  });

  return created({ ...job, id: String(job.id) });
}, { name: "POST /api/v1/queue" });
