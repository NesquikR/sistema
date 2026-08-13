import { NotFoundError } from "@/server/core/errors";
import { createLogger } from "@/server/core/logger";
import type { HandlerDefinition, JobContext, QueueName } from "./types";

const log = createLogger("queue.handlers");

/**
 * Registro de handlers.
 *
 * Um job na fila é só um nome + payload JSON. Este registro é o que liga esse
 * nome a código executável. Handlers são registrados no bootstrap; um job cujo
 * nome não está registrado falha explicitamente em vez de sumir em silêncio.
 */
class HandlerRegistry {
  private readonly handlers = new Map<string, HandlerDefinition<never>>();

  register<P>(definition: HandlerDefinition<P>) {
    if (this.handlers.has(definition.name)) {
      log.warn("Handler sobrescrito", { name: definition.name });
    }
    this.handlers.set(definition.name, definition as unknown as HandlerDefinition<never>);
    log.debug("Handler registrado", { name: definition.name, queue: definition.queue });
  }

  get(name: string): HandlerDefinition<never> {
    const found = this.handlers.get(name);
    if (!found) throw new NotFoundError("Handler de fila", name);
    return found;
  }

  has(name: string) {
    return this.handlers.has(name);
  }

  list() {
    return [...this.handlers.values()].map((h) => ({
      name: h.name,
      queue: h.queue,
      timeoutMs: h.timeoutMs ?? null,
      maxAttempts: h.maxAttempts ?? null,
    }));
  }

  byQueue(queue: QueueName) {
    return [...this.handlers.values()].filter((h) => h.queue === queue);
  }

  clear() {
    this.handlers.clear();
  }
}

/** Mesmo motivo do registro de conectores: sobrevive ao hot reload. */
const globalForHandlers = globalThis as unknown as {
  __beautybotHandlerRegistry?: HandlerRegistry;
};

export const handlerRegistry =
  globalForHandlers.__beautybotHandlerRegistry ?? new HandlerRegistry();

globalForHandlers.__beautybotHandlerRegistry = handlerRegistry;

// ---------------------------------------------------------------------------
// Handlers de infraestrutura
//
// Nenhuma regra de negócio ainda: são os handlers mínimos para provar que o
// caminho completo (enqueue → dequeue → execução → conclusão) funciona.
// ---------------------------------------------------------------------------

export interface NoopPayload {
  echo?: string;
  sleepMs?: number;
}

/** Prova de vida do pipeline: registra, dorme e conclui. */
export const noopHandler: HandlerDefinition<NoopPayload> = {
  name: "system.noop",
  queue: "default",
  timeoutMs: 30_000,
  async handler(payload, ctx: JobContext) {
    const sleepMs = Math.min(payload.sleepMs ?? 0, 5_000);
    if (sleepMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, sleepMs));
    }
    return {
      message: "noop concluído",
      data: { echo: payload.echo ?? null, attempt: ctx.attempt },
    };
  },
};

/** Handler que sempre falha — existe para exercitar retry e DLQ. */
export const failingHandler: HandlerDefinition<{ reason?: string }> = {
  name: "system.fail",
  queue: "default",
  maxAttempts: 2,
  async handler(payload) {
    throw new Error(payload.reason ?? "falha proposital para teste de retry");
  },
};

export * from "./handlers/sync-store.handler";
export * from "./handlers/evaluate-offer.handler";
export * from "./handlers/publish-offer.handler";
export * from "./handlers/master-jobs.handler";
