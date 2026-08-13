import { loadEnv } from "@/server/config/env";
import { getContext } from "@/server/core/context";
import { serializeError } from "@/server/core/errors";

/**
 * Logger centralizado.
 *
 * Escreve sempre em stdout e, opcionalmente, na tabela `logs`. A persistência é
 * **fire-and-forget e nunca lança**: um log que derruba a operação que ele
 * deveria apenas observar é pior do que log nenhum. Se o banco estiver fora, o
 * stdout continua funcionando — que é exatamente quando mais se precisa dele.
 */

export type Level = "trace" | "debug" | "info" | "success" | "warn" | "error" | "fatal";

const RANK: Record<Level, number> = {
  trace: 10,
  debug: 20,
  info: 30,
  success: 30,
  warn: 40,
  error: 50,
  fatal: 60,
};

const PRISMA_LEVEL: Record<Level, string> = {
  trace: "TRACE",
  debug: "DEBUG",
  info: "INFO",
  success: "SUCCESS",
  warn: "WARN",
  error: "ERROR",
  fatal: "FATAL",
};

const COLOR: Record<Level, string> = {
  trace: "\x1b[90m",
  debug: "\x1b[90m",
  info: "\x1b[36m",
  success: "\x1b[32m",
  warn: "\x1b[33m",
  error: "\x1b[31m",
  fatal: "\x1b[41m\x1b[97m",
};
const RESET = "\x1b[0m";
const DIM = "\x1b[2m";

export interface LogFields {
  [key: string]: unknown;
  durationMs?: number;
  error?: unknown;
  /** Não persistir esta entrada (evita recursão ao logar falha de persistência). */
  skipPersist?: boolean;
}

type Sink = (entry: PersistedEntry) => void;

export interface PersistedEntry {
  level: Level;
  source: string;
  message: string;
  context: Record<string, unknown> | null;
  correlationId?: string;
  executionId?: string;
  storeId?: string;
  durationMs?: number;
  errorStack?: string;
}

/**
 * O sink é injetado no bootstrap, não importado aqui. Se o logger importasse o
 * repositório, e o repositório importasse o logger, teríamos um ciclo de
 * módulos — e o logger precisa funcionar antes de o banco existir.
 */
let sink: Sink | null = null;
export function setLogSink(fn: Sink | null) {
  sink = fn;
}

function threshold(): number {
  try {
    return RANK[loadEnv().LOG_LEVEL];
  } catch {
    return RANK.info; // env ainda não carregada: não silencia nada por acidente
  }
}

function isJson(): boolean {
  try {
    return loadEnv().LOG_FORMAT === "json";
  } catch {
    return false;
  }
}

function shouldPersist(): boolean {
  try {
    return loadEnv().LOG_PERSIST;
  } catch {
    return false;
  }
}

function write(level: Level, source: string, message: string, fields: LogFields = {}) {
  if (RANK[level] < threshold()) return;

  const ctx = getContext();
  const { error, skipPersist, durationMs, ...rest } = fields;
  const serialized = error !== undefined ? serializeError(error) : undefined;

  const context: Record<string, unknown> = { ...rest };
  if (serialized) {
    context.errorCode = serialized.code;
    context.errorMessage = serialized.message;
    if (serialized.details !== undefined) context.errorDetails = serialized.details;
  }

  const entry: PersistedEntry = {
    level,
    source,
    message,
    context: Object.keys(context).length ? context : null,
    correlationId: ctx?.correlationId,
    executionId: ctx?.executionId,
    storeId: ctx?.storeId,
    durationMs,
    errorStack: serialized?.stack,
  };

  emit(entry);

  if (sink && shouldPersist() && !skipPersist) {
    try {
      sink(entry);
    } catch {
      // Persistir log jamais pode quebrar o fluxo que o gerou.
    }
  }
}

function emit(entry: PersistedEntry) {
  const stream = RANK[entry.level] >= RANK.error ? process.stderr : process.stdout;

  if (isJson()) {
    stream.write(
      JSON.stringify({ ts: new Date().toISOString(), ...entry }) + "\n",
    );
    return;
  }

  const time = new Date().toLocaleTimeString("pt-BR", { hour12: false });
  const tag = PRISMA_LEVEL[entry.level].padEnd(7);
  const corr = entry.correlationId ? `${DIM}${entry.correlationId.slice(0, 8)}${RESET} ` : "";
  const dur = entry.durationMs !== undefined ? ` ${DIM}${entry.durationMs}ms${RESET}` : "";
  const ctxStr =
    entry.context && Object.keys(entry.context).length
      ? ` ${DIM}${JSON.stringify(entry.context)}${RESET}`
      : "";

  stream.write(
    `${DIM}${time}${RESET} ${COLOR[entry.level]}${tag}${RESET} ${corr}` +
      `${DIM}${entry.source}${RESET}  ${entry.message}${dur}${ctxStr}\n`,
  );

  if (entry.errorStack && RANK[entry.level] >= RANK.error) {
    stream.write(`${DIM}${entry.errorStack}${RESET}\n`);
  }
}

export interface Logger {
  trace(message: string, fields?: LogFields): void;
  debug(message: string, fields?: LogFields): void;
  info(message: string, fields?: LogFields): void;
  success(message: string, fields?: LogFields): void;
  warn(message: string, fields?: LogFields): void;
  error(message: string, fields?: LogFields): void;
  fatal(message: string, fields?: LogFields): void;
  child(source: string): Logger;
  /** Mede a duração e loga sucesso ou falha automaticamente. */
  timed<T>(message: string, fn: () => Promise<T>, fields?: LogFields): Promise<T>;
}

export function createLogger(source: string): Logger {
  const at = (level: Level) => (message: string, fields?: LogFields) =>
    write(level, source, message, fields);

  return {
    trace: at("trace"),
    debug: at("debug"),
    info: at("info"),
    success: at("success"),
    warn: at("warn"),
    error: at("error"),
    fatal: at("fatal"),
    child: (sub: string) => createLogger(`${source}.${sub}`),
    async timed<T>(message: string, fn: () => Promise<T>, fields: LogFields = {}) {
      const started = Date.now();
      try {
        const result = await fn();
        write("success", source, message, { ...fields, durationMs: Date.now() - started });
        return result;
      } catch (e) {
        write("error", source, `${message} — falhou`, {
          ...fields,
          durationMs: Date.now() - started,
          error: e,
        });
        throw e;
      }
    },
  };
}

export const logger = createLogger("app");
