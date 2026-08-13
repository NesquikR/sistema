import type { NextRequest } from "next/server";
import { z } from "zod";
import { bootstrap } from "@/server/bootstrap";
import {
  parseBody,
  withApiHandler,
  type RouteContext,
} from "@/server/http/handler";
import { ok } from "@/server/http/responses";
import { storeService } from "@/server/services/store.service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Params = { id: string };

const updateBody = z
  .object({
    name: z.string().min(2).max(120).optional(),
    isActive: z.boolean().optional(),
    status: z.enum(["ACTIVE", "DEGRADED", "OFFLINE", "PAUSED", "DEPRECATED"]).optional(),
    priority: z.number().int().min(1).max(1000).optional(),
    accentColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
    rateLimitPerMinute: z.number().int().min(1).max(10_000).optional(),
    quotaDailyLimit: z.number().int().min(1).optional(),
  })
  .refine((v) => Object.keys(v).length > 0, {
    message: "Informe ao menos um campo para atualizar",
  });

export const GET = withApiHandler<Params>(async (_request, context: RouteContext<Params>) => {
  await bootstrap("web");
  const { id } = await context.params;
  return ok(await storeService.getById(id));
}, { name: "GET /api/v1/stores/[id]" });

export const PATCH = withApiHandler<Params>(
  async (request: NextRequest, context: RouteContext<Params>) => {
    await bootstrap("web");
    const { id } = await context.params;
    const body = await parseBody(request, updateBody);
    return ok(await storeService.update(id, body));
  },
  { name: "PATCH /api/v1/stores/[id]" },
);

export const DELETE = withApiHandler<Params>(
  async (_request, context: RouteContext<Params>) => {
    await bootstrap("web");
    const { id } = await context.params;
    return ok(await storeService.remove(id));
  },
  { name: "DELETE /api/v1/stores/[id]" },
);
