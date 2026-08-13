import { bootstrap } from "@/server/bootstrap";
import { withApiHandler } from "@/server/http/handler";
import { ok } from "@/server/http/responses";
import { providerRegistry } from "@/server/providers/registry";
import { storeService } from "@/server/services/store.service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * GET /api/v1/providers — conectores registrados e panorama de lojas.
 * Também é o lugar onde se enxerga o descompasso entre o que está registrado
 * em código e o que está cadastrado no banco.
 */
export const GET = withApiHandler(async () => {
  await bootstrap("web");

  const [providers, overview] = await Promise.all([
    Promise.resolve(providerRegistry.describe()),
    storeService.overview(),
  ]);

  return ok({ providers, stores: overview });
}, { name: "GET /api/v1/providers" });
