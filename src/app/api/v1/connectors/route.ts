import type { NextRequest } from "next/server";
import { z } from "zod";
import { bootstrap } from "@/server/bootstrap";
import { isEncryptionConfigured } from "@/server/core/crypto";
import { parseBody, withApiHandler } from "@/server/http/handler";
import { created, ok } from "@/server/http/responses";
import { connectorService } from "@/server/services/connector.service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const installBody = z.object({
  connectorKey: z.string().min(2).max(120),
  credentials: z.record(z.string(), z.string()).default({}),
  displayName: z.string().min(2).max(120).optional(),
});

/**
 * GET /api/v1/connectors — catálogo de lojas integráveis.
 * Não depende do banco: alimenta a tela de "Adicionar conector" mesmo com o
 * Postgres fora.
 */
export const GET = withApiHandler(async () => {
  await bootstrap("web");
  return ok({
    connectors: connectorService.catalog(),
    encryptionConfigured: isEncryptionConfigured(),
  });
}, { name: "GET /api/v1/connectors" });

/** POST /api/v1/connectors — instala a loja com as credenciais criptografadas. */
export const POST = withApiHandler(async (request: NextRequest) => {
  await bootstrap("web");
  const body = await parseBody(request, installBody);
  const store = await connectorService.install(body);
  return created(store);
}, { name: "POST /api/v1/connectors" });
