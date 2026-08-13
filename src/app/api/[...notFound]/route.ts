import { withApiHandler } from "@/server/http/handler";
import { NotFoundError } from "@/server/core/errors";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Catch-all da API.
 *
 * Sem isto, uma rota inexistente sob /api devolveria a página HTML de 404 do
 * Next — um cliente que espera JSON receberia `<!DOCTYPE html>` e quebraria no
 * parse, com uma mensagem de erro que não ajuda ninguém. Rotas específicas têm
 * precedência sobre o catch-all, então nada existente é afetado.
 */
const notFound = withApiHandler(async () => {
  throw new NotFoundError("Endpoint");
}, { name: "API 404" });

export const GET = notFound;
export const POST = notFound;
export const PUT = notFound;
export const PATCH = notFound;
export const DELETE = notFound;
export const HEAD = notFound;
export const OPTIONS = notFound;
