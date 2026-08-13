import type { NextRequest } from "next/server";
import { bootstrap } from "@/server/bootstrap";
import { withApiHandler } from "@/server/http/handler";
import { ok } from "@/server/http/responses";
import { analyticsService } from "@/server/services/analytics.service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** GET /api/v1/dashboard */
export const GET = withApiHandler(async (_request: NextRequest) => {
  await bootstrap("web");
  const stats = await analyticsService.getDashboardStats();
  return ok(stats);
}, { name: "GET /api/v1/dashboard" });
