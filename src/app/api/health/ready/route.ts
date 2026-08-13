import { bootstrap } from "@/server/bootstrap";
import { withApiHandler } from "@/server/http/handler";
import { ok } from "@/server/http/responses";
import { healthService } from "@/server/services/health.service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** GET /api/health/ready — readiness: pode receber tráfego? Depende do banco. */
export const GET = withApiHandler(async () => {
  await bootstrap("web");
  const result = await healthService.readiness();
  return ok(result, undefined, result.state === "healthy" ? 200 : 503);
}, { name: "GET /api/health/ready" });
