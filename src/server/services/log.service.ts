import type { LogLevel, Prisma } from "@prisma/client";
import { logRepository } from "@/server/repositories/log.repository";
import { setLogSink, type PersistedEntry } from "@/server/core/logger";

const LEVEL_MAP: Record<PersistedEntry["level"], LogLevel> = {
  trace: "TRACE",
  debug: "DEBUG",
  info: "INFO",
  success: "SUCCESS",
  warn: "WARN",
  error: "ERROR",
  fatal: "FATAL",
};

/**
 * Persistência de logs com buffer.
 *
 * O logger produz entradas sincronamente; este serviço as acumula e grava em
 * lote. Três salvaguardas importam mais que a performance:
 *
 *   · **Teto de buffer.** Se o banco cair, as entradas mais antigas são
 *     descartadas em vez de crescer até estourar a memória do processo.
 *   · **Flush nunca lança.** Falha ao gravar log vira aviso em stderr, não
 *     exceção que sobe para o job que estava apenas sendo observado.
 *   · **Flush no shutdown.** Sem isso, os últimos segundos antes de um
 *     encerramento — justamente os interessantes num incidente — se perderiam.
 */
const FLUSH_INTERVAL_MS = 2_000;
const FLUSH_SIZE = 50;
const MAX_BUFFER = 5_000;

export class LogService {
  private buffer: Prisma.LogCreateManyInput[] = [];
  private timer: NodeJS.Timeout | null = null;
  private dropped = 0;
  private attached = false;

  /** Liga o logger a este serviço. Chamado no bootstrap. */
  attach() {
    if (this.attached) return;
    setLogSink((entry) => this.push(entry));
    this.timer = setInterval(() => void this.flush(), FLUSH_INTERVAL_MS);
    this.timer.unref?.();
    this.attached = true;
  }

  async detach() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    setLogSink(null);
    this.attached = false;
    await this.flush();
  }

  private push(entry: PersistedEntry) {
    if (this.buffer.length >= MAX_BUFFER) {
      this.buffer.shift();
      this.dropped++;
      return;
    }

    this.buffer.push({
      level: LEVEL_MAP[entry.level],
      source: entry.source,
      message: entry.message,
      context: (entry.context ?? undefined) as Prisma.InputJsonValue | undefined,
      correlationId: entry.correlationId,
      executionId: entry.executionId,
      storeId: entry.storeId,
      durationMs: entry.durationMs,
      errorStack: entry.errorStack,
    });

    if (this.buffer.length >= FLUSH_SIZE) void this.flush();
  }

  async flush(): Promise<number> {
    if (!this.buffer.length) return 0;

    const batch = this.buffer;
    this.buffer = [];

    try {
      await logRepository.createMany(batch);
      return batch.length;
    } catch (e) {
      // Sem logger aqui: seria recursão.
      process.stderr.write(
        `[log.service] falha ao persistir ${batch.length} entradas: ${
          e instanceof Error ? e.message : String(e)
        }\n`,
      );
      return 0;
    }
  }

  get stats() {
    return {
      buffered: this.buffer.length,
      dropped: this.dropped,
      attached: this.attached,
    };
  }

  // -- Consulta (usada pela tela de Logs) ------------------------------------

  query(filter: Parameters<typeof logRepository.findMany>[0]) {
    return logRepository.findMany(filter);
  }

  async summary(sinceMs = 3_600_000) {
    const rows = await logRepository.countByLevel(new Date(Date.now() - sinceMs));
    return Object.fromEntries(rows.map((r) => [r.level, r._count._all]));
  }

  purge(before: Date, levels?: LogLevel[]) {
    return logRepository.purge(before, levels);
  }
}

export const logService = new LogService();
