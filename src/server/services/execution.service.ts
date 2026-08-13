import type { ExecutionStatus, Prisma, TriggerType } from "@prisma/client";
import { patchContext } from "@/server/core/context";
import { NotFoundError, normalizeError } from "@/server/core/errors";
import { createLogger } from "@/server/core/logger";
import { executionRepository } from "@/server/repositories/execution.repository";

const log = createLogger("services.execution");

/**
 * Rastreamento de execuções.
 *
 * `track` envolve qualquer trabalho longo e garante que a execução seja
 * **sempre** encerrada — sucesso ou falha. Sem esse envelope, um `throw` no
 * meio de um conector deixaria a linha presa em `RUNNING` para sempre, e o
 * painel mostraria uma execução eterna que nunca existiu.
 *
 * Ele também injeta o `executionId` no contexto, de modo que todo log emitido
 * lá dentro já sai correlacionado — sem precisar passar o id adiante.
 */
export class ExecutionService {
  async track<T>(
    input: {
      jobId?: string;
      storeId?: string;
      parentExecutionId?: string;
      trigger?: TriggerType;
      correlationId?: string;
    },
    work: (executionId: string) => Promise<T>,
  ): Promise<T> {
    const execution = await executionRepository.start(input);
    patchContext({ executionId: execution.id, storeId: input.storeId });

    const startedAt = execution.startedAt;

    try {
      const result = await work(execution.id);
      await executionRepository.finishWithDuration(execution.id, "SUCCESS", startedAt);
      return result;
    } catch (e) {
      const err = normalizeError(e);
      await executionRepository.finishWithDuration(execution.id, "FAILED", startedAt, {
        errorCount: 1,
        errorMessage: err.message,
      });
      log.error("Execução falhou", { executionId: execution.id, error: err });
      throw e;
    }
  }

  /** Passo nomeado dentro de uma execução, com duração medida. */
  async step<T>(
    executionId: string,
    sequence: number,
    name: string,
    work: () => Promise<T>,
    input?: Prisma.InputJsonValue,
  ): Promise<T> {
    const step = await executionRepository.addStep({ executionId, sequence, name, input });
    const started = Date.now();

    try {
      const result = await work();
      await executionRepository.finishStep(step.id, "SUCCESS", {
        durationMs: Date.now() - started,
      });
      return result;
    } catch (e) {
      await executionRepository.finishStep(step.id, "FAILED", {
        durationMs: Date.now() - started,
        errorText: normalizeError(e).message,
      });
      throw e;
    }
  }

  async getById(id: string) {
    const execution = await executionRepository.findById(id);
    if (!execution) throw new NotFoundError("Execução", id);
    return execution;
  }

  list(filter: Parameters<typeof executionRepository.findMany>[0]) {
    return executionRepository.findMany(filter);
  }

  /**
   * Marca como TIMEOUT execuções presas em RUNNING além do limite.
   * Um processo morto no meio de um ciclo não consegue encerrar a própria
   * linha — alguém precisa fazer isso por ele.
   */
  async reapStuck(olderThanMs: number): Promise<number> {
    const stuck = await executionRepository.findStuck(new Date(Date.now() - olderThanMs));

    for (const execution of stuck) {
      await executionRepository.finishWithDuration(
        execution.id,
        "TIMEOUT" as ExecutionStatus,
        execution.startedAt,
        { errorMessage: "Execução interrompida sem encerramento (processo encerrado?)" },
      );
    }

    if (stuck.length) {
      log.warn("Execuções travadas encerradas como TIMEOUT", { total: stuck.length });
    }
    return stuck.length;
  }
}

export const executionService = new ExecutionService();
