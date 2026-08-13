import type { NextRequest } from "next/server";
import { bootstrap } from "@/server/bootstrap";
import { withApiHandler } from "@/server/http/handler";
import { ok } from "@/server/http/responses";
import { healthService } from "@/server/services/health.service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * GET /api/health — diagnóstico completo.
 *
 * Responde 200 quando saudável ou degradado, e 503 apenas quando alguma
 * dependência essencial está fora. Degradado ainda atende tráfego; tratá-lo
 * como indisponível tiraria o sistema do ar sem necessidade.
 */
export const GET = withApiHandler(async (_request: NextRequest) => {
  await bootstrap("web");
  const report = await healthService.full();
  return ok(report, undefined, report.state === "unhealthy" ? 503 : 200);
}, { name: "GET /api/health" });
