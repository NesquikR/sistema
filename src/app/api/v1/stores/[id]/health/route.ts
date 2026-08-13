import { bootstrap } from "@/server/bootstrap";
import { withApiHandler, type RouteContext } from "@/server/http/handler";
import { ok } from "@/server/http/responses";
import { storeService } from "@/server/services/store.service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Params = { id: string };

/**
 * POST /api/v1/stores/[id]/health
 * Executa o healthCheck do conector e persiste o resultado na loja.
 */
export const POST = withApiHandler<Params>(
  async (_request, context: RouteContext<Params>) => {
    await bootstrap("web");
    const { id } = await context.params;
    return ok(await storeService.checkConnector(id));
  },
  { name: "POST /api/v1/stores/[id]/health" },
);
