import type { NextRequest } from "next/server";
import { z } from "zod";
import { bootstrap } from "@/server/bootstrap";
import { parseBody, withApiHandler } from "@/server/http/handler";
import { ok } from "@/server/http/responses";
import { connectorService } from "@/server/services/connector.service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const testBody = z.object({
  connectorKey: z.string().min(2).max(120),
  credentials: z.record(z.string(), z.string()).default({}),
});

/**
 * POST /api/v1/connectors/test
 *
 * Fala com a loja real e devolve o resultado — sem gravar nada e sem depender
 * do banco. É o que permite descobrir que uma Client Secret está errada antes
 * de ela virar uma linha em `store_credentials`.
 *
 * Responde sempre 200: uma credencial recusada é um resultado válido do teste,
 * não um erro da requisição. O campo `ok` carrega o veredicto.
 */
export const POST = withApiHandler(async (request: NextRequest) => {
  await bootstrap("web");
  const body = await parseBody(request, testBody);
  const result = await connectorService.test(body.connectorKey, body.credentials);
  return ok(result);
}, { name: "POST /api/v1/connectors/test" });
