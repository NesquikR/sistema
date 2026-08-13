import { NextResponse } from "next/server";
import { getCorrelationId } from "@/server/core/context";
import type { AppError } from "@/server/core/errors";

/**
 * Envelope único de resposta.
 *
 * Toda resposta da API — sucesso ou erro — tem a mesma forma externa, com
 * `success` discriminando as duas. O cliente escreve um só tratamento, e o
 * `correlationId` viaja em toda resposta: quando algo dá errado, o id que o
 * usuário vê na tela é o mesmo que encontra a linha exata na tabela de logs.
 */

export interface Meta {
  correlationId?: string;
  timestamp: string;
  [key: string]: unknown;
}

export interface SuccessBody<T> {
  success: true;
  data: T;
  meta: Meta;
}

export interface ErrorBody {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
  meta: Meta;
}

function meta(extra?: Record<string, unknown>): Meta {
  return {
    correlationId: getCorrelationId(),
    timestamp: new Date().toISOString(),
    ...extra,
  };
}

export function ok<T>(data: T, extra?: Record<string, unknown>, status = 200) {
  return NextResponse.json<SuccessBody<T>>(
    { success: true, data, meta: meta(extra) },
    { status },
  );
}

export function created<T>(data: T, extra?: Record<string, unknown>) {
  return ok(data, extra, 201);
}

export function noContent() {
  return new NextResponse(null, { status: 204 });
}

export function paginated<T>(page: {
  items: T[];
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
}) {
  return ok(page.items, {
    pagination: {
      total: page.total,
      limit: page.limit,
      offset: page.offset,
      hasMore: page.hasMore,
    },
  });
}

export function fail(error: AppError) {
  return NextResponse.json<ErrorBody>(
    {
      success: false,
      error: {
        code: error.code,
        message: error.message,
        details: error.details,
      },
      meta: meta(),
    },
    { status: error.status },
  );
}
