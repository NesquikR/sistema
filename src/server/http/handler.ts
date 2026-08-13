import type { NextRequest } from "next/server";
import { ZodError, type ZodType } from "zod";
import {
  newCorrelationId,
  runWithContext,
} from "@/server/core/context";
import {
  BadRequestError,
  ValidationError,
  normalizeError,
} from "@/server/core/errors";
import { createLogger } from "@/server/core/logger";
import { fail } from "./responses";

const log = createLogger("http");

/**
 * Wrapper global das rotas.
 *
 * Toda rota é embrulhada aqui, e isso dá quatro coisas de uma vez:
 *
 *   1. **Nenhum stack trace vaza.** Erros não operacionais viram uma mensagem
 *      genérica para o cliente; o detalhe fica no log, com o correlationId.
 *   2. **Correlação automática.** Se o cliente mandar `x-correlation-id`, ele é
 *      reaproveitado — o que permite seguir um rastro que começou no navegador.
 *   3. **Log de acesso uniforme**, com duração e status.
 *   4. **Zero try/catch nas rotas.** Elas só descrevem o caso feliz e lançam
 *      `NotFoundError`, `ValidationError` etc. quando algo foge disso.
 */
export type RouteContext<P = Record<string, string>> = {
  params: Promise<P>;
};

type Handler<P> = (
  request: NextRequest,
  context: RouteContext<P>,
) => Promise<Response>;

export function withApiHandler<P = Record<string, string>>(
  handler: Handler<P>,
  options: { name?: string } = {},
): Handler<P> {
  return async (request, context) => {
    const correlationId =
      request.headers.get("x-correlation-id") ?? newCorrelationId();
    const route = options.name ?? new URL(request.url).pathname;
    const started = Date.now();

    return runWithContext({ source: "http", correlationId, route }, async () => {
      try {
        const response = await handler(request, context);
        response.headers.set("x-correlation-id", correlationId);

        log.debug("Requisição atendida", {
          method: request.method,
          route,
          status: response.status,
          durationMs: Date.now() - started,
        });

        return response;
      } catch (e) {
        const error = normalizeError(e);
        const durationMs = Date.now() - started;

        if (error.status >= 500) {
          log.error("Requisição falhou", {
            method: request.method,
            route,
            status: error.status,
            durationMs,
            error,
          });
        } else {
          log.warn("Requisição rejeitada", {
            method: request.method,
            route,
            status: error.status,
            code: error.code,
            durationMs,
          });
        }

        // Bug de programação nunca expõe a mensagem interna ao cliente.
        const safe =
          error.operational || error.status < 500
            ? error
            : Object.assign(Object.create(Object.getPrototypeOf(error)), error, {
                message: "Erro interno. Consulte os logs pelo correlationId.",
                details: undefined,
              });

        const response = fail(safe);
        response.headers.set("x-correlation-id", correlationId);
        return response;
      }
    });
  };
}

// ---------------------------------------------------------------------------
// Validação
// ---------------------------------------------------------------------------

export async function parseBody<T>(request: NextRequest, schema: ZodType<T>): Promise<T> {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    throw new BadRequestError("Corpo da requisição não é um JSON válido");
  }
  return validate(schema, raw);
}

export function parseQuery<T>(request: NextRequest, schema: ZodType<T>): T {
  const params = Object.fromEntries(new URL(request.url).searchParams.entries());
  return validate(schema, params);
}

export function validate<T>(schema: ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value);
  if (result.success) return result.data;
  throw new ValidationError("Dados inválidos", formatZodError(result.error));
}

function formatZodError(error: ZodError) {
  return error.issues.map((issue) => ({
    campo: issue.path.join(".") || "(raiz)",
    mensagem: issue.message,
    codigo: issue.code,
  }));
}
