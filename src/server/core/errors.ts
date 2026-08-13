/**
 * Hierarquia de erros da aplicação.
 *
 * Regra: todo erro que atravessa uma fronteira (HTTP, fila, scheduler) é um
 * `AppError`. Isso dá três garantias que `throw new Error("falhou")` não dá:
 *   1. status HTTP correto sem `if` espalhado pelos handlers;
 *   2. distinção entre falha esperada (operacional) e bug — só o segundo tipo
 *      merece alarme;
 *   3. `retryable`, que a fila usa para decidir entre reenfileirar e mandar
 *      direto para a DLQ. Reprocessar 3× um payload inválido é desperdício;
 *      não reprocessar um timeout de rede é perda de dado.
 */

export type ErrorCode =
  | "BAD_REQUEST"
  | "VALIDATION_ERROR"
  | "NOT_FOUND"
  | "CONFLICT"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "RATE_LIMITED"
  | "TIMEOUT"
  | "UPSTREAM_ERROR"
  | "DATABASE_ERROR"
  | "CONFIG_ERROR"
  | "NOT_IMPLEMENTED"
  | "INTERNAL_ERROR";

export interface AppErrorOptions {
  code?: ErrorCode;
  status?: number;
  details?: unknown;
  cause?: unknown;
  retryable?: boolean;
  /** `false` sinaliza bug de programação — merece alarme, não retry. */
  operational?: boolean;
}

export class AppError extends Error {
  readonly code: ErrorCode;
  readonly status: number;
  readonly details?: unknown;
  readonly retryable: boolean;
  readonly operational: boolean;

  constructor(message: string, options: AppErrorOptions = {}) {
    super(message);
    this.name = new.target.name;
    this.code = options.code ?? "INTERNAL_ERROR";
    this.status = options.status ?? 500;
    this.details = options.details;
    this.retryable = options.retryable ?? false;
    this.operational = options.operational ?? true;
    if (options.cause !== undefined) this.cause = options.cause;
    Error.captureStackTrace?.(this, new.target);
  }

  toJSON() {
    return {
      name: this.name,
      code: this.code,
      status: this.status,
      message: this.message,
      details: this.details,
      retryable: this.retryable,
    };
  }
}

export class BadRequestError extends AppError {
  constructor(message = "Requisição inválida", details?: unknown) {
    super(message, { code: "BAD_REQUEST", status: 400, details });
  }
}

export class ValidationError extends AppError {
  constructor(message = "Dados inválidos", details?: unknown) {
    super(message, { code: "VALIDATION_ERROR", status: 422, details });
  }
}

export class NotFoundError extends AppError {
  constructor(resource = "Recurso", id?: string) {
    super(id ? `${resource} não encontrado: ${id}` : `${resource} não encontrado`, {
      code: "NOT_FOUND",
      status: 404,
    });
  }
}

export class ConflictError extends AppError {
  constructor(message = "Conflito de estado", details?: unknown) {
    super(message, { code: "CONFLICT", status: 409, details });
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = "Não autenticado") {
    super(message, { code: "UNAUTHORIZED", status: 401 });
  }
}

export class ForbiddenError extends AppError {
  constructor(message = "Acesso negado") {
    super(message, { code: "FORBIDDEN", status: 403 });
  }
}

/** Erro de parceiro externo: por padrão vale a pena tentar de novo. */
export class UpstreamError extends AppError {
  constructor(message = "Falha em serviço externo", options: AppErrorOptions = {}) {
    super(message, {
      code: "UPSTREAM_ERROR",
      status: 502,
      retryable: true,
      ...options,
    });
  }
}

export class RateLimitError extends AppError {
  readonly retryAfterMs?: number;
  constructor(message = "Limite de requisições atingido", retryAfterMs?: number) {
    super(message, { code: "RATE_LIMITED", status: 429, retryable: true });
    this.retryAfterMs = retryAfterMs;
  }
}

export class TimeoutError extends AppError {
  constructor(message = "Tempo limite excedido") {
    super(message, { code: "TIMEOUT", status: 504, retryable: true });
  }
}

export class DatabaseError extends AppError {
  constructor(message = "Falha ao acessar o banco de dados", cause?: unknown) {
    super(message, { code: "DATABASE_ERROR", status: 503, retryable: true, cause });
  }
}

export class ConfigError extends AppError {
  constructor(message: string) {
    super(message, { code: "CONFIG_ERROR", status: 500, operational: false });
  }
}

export class NotImplementedError extends AppError {
  constructor(what = "Funcionalidade") {
    super(`${what} ainda não implementada`, {
      code: "NOT_IMPLEMENTED",
      status: 501,
    });
  }
}

// ---------------------------------------------------------------------------

export function isAppError(e: unknown): e is AppError {
  return e instanceof AppError;
}

/**
 * Converte qualquer valor lançado em `AppError`.
 * JavaScript permite `throw "texto"` e `throw undefined` — normalizar aqui é o
 * que garante que o restante do sistema nunca precise pensar nisso.
 */
export function normalizeError(e: unknown): AppError {
  if (isAppError(e)) return e;

  if (e instanceof Error) {
    // Erros de conexão do driver do Postgres são operacionais e retryable.
    const code = (e as NodeJS.ErrnoException).code;
    if (code && ["ECONNREFUSED", "ETIMEDOUT", "ENOTFOUND", "ECONNRESET"].includes(code)) {
      return new DatabaseError(`Banco de dados inacessível (${code})`, e);
    }
    return new AppError(e.message, { cause: e, operational: false });
  }

  return new AppError("Erro desconhecido", { details: e, operational: false });
}

export function serializeError(e: unknown) {
  const err = normalizeError(e);
  return {
    code: err.code,
    message: err.message,
    details: err.details,
    stack: err.stack,
  };
}
