import type { NextRequest } from "next/server";
import { z } from "zod";
import { bootstrap } from "@/server/bootstrap";
import { parseQuery, withApiHandler } from "@/server/http/handler";
import { ok } from "@/server/http/responses";
import { logService } from "@/server/services/log.service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const query = z.object({
  level: z.enum(["TRACE", "DEBUG", "INFO", "SUCCESS", "WARN", "ERROR", "FATAL"]).optional(),
  source: z.string().max(120).optional(),
  search: z.string().max(200).optional(),
  correlationId: z.string().uuid().optional(),
  executionId: z.string().optional(),
  sinceMinutes: z.coerce.number().int().min(1).max(10_080).optional(),
  limit: z.coerce.number().int().min(1).max(500).default(100),
  offset: z.coerce.number().int().min(0).default(0),
});

/** GET /api/v1/logs */
export const GET = withApiHandler(async (request: NextRequest) => {
  await bootstrap("web");
  const q = parseQuery(request, query);

  const [page, summary] = await Promise.all([
    logService.query({
      level: q.level,
      source: q.source,
      search: q.search,
      correlationId: q.correlationId,
      executionId: q.executionId,
      since: q.sinceMinutes ? new Date(Date.now() - q.sinceMinutes * 60_000) : undefined,
      limit: q.limit,
      offset: q.offset,
    }),
    logService.summary(),
  ]);

  return ok({
    items: page.items.map((l) => ({ ...l, id: String(l.id) })),
    summary,
    buffer: logService.stats,
    pagination: {
      total: page.total,
      limit: page.limit,
      offset: page.offset,
      hasMore: page.hasMore,
    },
  });
}, { name: "GET /api/v1/logs" });
