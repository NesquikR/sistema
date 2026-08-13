import type { NextRequest } from "next/server";
import { z } from "zod";
import { bootstrap } from "@/server/bootstrap";
import { parseBody, withApiHandler } from "@/server/http/handler";
import { ok } from "@/server/http/responses";
import { oauthService } from "@/server/services/oauth.service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const body = z.object({
  connectorKey: z.string().min(2),
  clientId: z.string().min(3),
  clientSecret: z.string().min(3),
  siteId: z.string().optional(),
});

/**
 * POST /api/v1/connectors/oauth/start
 * Devolve a URL de autorização da loja. Não depende do banco.
 */
export const POST = withApiHandler(async (request: NextRequest) => {
  await bootstrap("web");
  const input = await parseBody(request, body);

  const origin = new URL(request.url).origin;
  return ok(oauthService.start({ ...input, origin }));
}, { name: "POST /api/v1/connectors/oauth/start" });
