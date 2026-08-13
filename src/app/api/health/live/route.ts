import { withApiHandler } from "@/server/http/handler";
import { ok } from "@/server/http/responses";
import { healthService } from "@/server/services/health.service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * GET /api/health/live — liveness.
 * Não toca no banco de propósito: responder 503 aqui por causa do Postgres
 * faria um orquestrador reiniciar a aplicação em loop sem motivo.
 */
export const GET = withApiHandler(async () => {
  return ok(await healthService.liveness());
}, { name: "GET /api/health/live" });
