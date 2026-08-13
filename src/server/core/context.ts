import { AsyncLocalStorage } from "node:async_hooks";
import { randomUUID } from "node:crypto";

/**
 * Contexto de execução propagado implicitamente.
 *
 * Sem isso, `correlationId` teria que ser passado como parâmetro por toda a
 * cadeia — rota → service → repository → logger — poluindo cada assinatura.
 * Com `AsyncLocalStorage`, qualquer ponto do código descobre a que requisição
 * ou job pertence, e os logs de uma execução ficam correlacionáveis mesmo
 * quando várias rodam em paralelo.
 */
export interface RequestContext {
  correlationId: string;
  source: "http" | "queue" | "scheduler" | "cli" | "system";
  route?: string;
  jobId?: string;
  executionId?: string;
  storeId?: string;
  startedAt: number;
}

const storage = new AsyncLocalStorage<RequestContext>();

export function runWithContext<T>(
  partial: Partial<RequestContext> & Pick<RequestContext, "source">,
  fn: () => T,
): T {
  const ctx: RequestContext = {
    correlationId: partial.correlationId ?? randomUUID(),
    startedAt: Date.now(),
    ...partial,
  };
  return storage.run(ctx, fn);
}

export function getContext(): RequestContext | undefined {
  return storage.getStore();
}

export function getCorrelationId(): string | undefined {
  return storage.getStore()?.correlationId;
}

/** Enriquece o contexto atual (ex.: a execução criada no meio de um job). */
export function patchContext(patch: Partial<RequestContext>) {
  const ctx = storage.getStore();
  if (ctx) Object.assign(ctx, patch);
}

export function newCorrelationId() {
  return randomUUID();
}
