import type { NextRequest } from "next/server";
import { z } from "zod";
import { bootstrap } from "@/server/bootstrap";
import { parseBody, parseQuery, withApiHandler } from "@/server/http/handler";
import { created, paginated } from "@/server/http/responses";
import { storeService } from "@/server/services/store.service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const listQuery = z.object({
  isActive: z.enum(["true", "false"]).optional(),
  status: z
    .enum(["ACTIVE", "DEGRADED", "OFFLINE", "PAUSED", "DEPRECATED"])
    .optional(),
  search: z.string().trim().min(1).max(120).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

const createBody = z.object({
  slug: z
    .string()
    .min(2)
    .max(60)
    .regex(/^[a-z0-9-]+$/, "Use apenas minúsculas, números e hífen"),
  name: z.string().min(2).max(120),
  connectorKey: z.string().min(2).max(120),
  integrationType: z
    .enum(["OFFICIAL_API", "AFFILIATE_API", "SCRAPER", "FEED", "MANUAL"])
    .optional(),
  accentColor: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, "Cor deve estar no formato #RRGGBB")
    .optional(),
  priority: z.number().int().min(1).max(1000).optional(),
});

/** GET /api/v1/stores */
export const GET = withApiHandler(async (request: NextRequest) => {
  await bootstrap("web");
  const query = parseQuery(request, listQuery);

  const page = await storeService.list({
    isActive: query.isActive ? query.isActive === "true" : undefined,
    status: query.status,
    search: query.search,
    limit: query.limit,
    offset: query.offset,
  });

  return paginated(page);
}, { name: "GET /api/v1/stores" });

/** POST /api/v1/stores */
export const POST = withApiHandler(async (request: NextRequest) => {
  await bootstrap("web");
  const body = await parseBody(request, createBody);
  const store = await storeService.create(body);
  return created(store);
}, { name: "POST /api/v1/stores" });
