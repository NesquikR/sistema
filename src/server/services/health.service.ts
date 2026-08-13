import { loadEnv } from "@/server/config/env";
import { normalizeError } from "@/server/core/errors";
import { pingDatabase } from "@/server/db";
import { providerRegistry } from "@/server/providers/registry";
import { handlerRegistry } from "@/server/queue/handlers";
import { queueService } from "@/server/queue/queue.service";
import { workerStatus } from "@/server/queue/worker";
import { scheduler } from "@/server/scheduler/scheduler";
import { getRuntimeInfo } from "@/server/bootstrap";

export type HealthState = "healthy" | "degraded" | "unhealthy";

export interface CheckResult {
  name: string;
  state: HealthState;
  latencyMs?: number;
  message?: string;
  details?: Record<string, unknown>;
}

export interface HealthReport {
  state: HealthState;
  version: string;
  environment: string;
  uptimeSeconds: number;
  startedAt: string | null;
  checkedAt: string;
  checks: CheckResult[];
}

/**
 * Health check.
 *
 * Distingue três estados, não dois. `degraded` é o que descreve a realidade na
 * maior parte dos incidentes: o sistema atende, mas alguma dependência não
 * essencial está ruim. Colapsar isso em "up/down" faz o alarme disparar tarde
 * demais ou o tempo todo.
 *
 * `liveness` responde "o processo está vivo?" e **nunca toca no banco** — se
 * respondesse 503 por causa do Postgres, um orquestrador reiniciaria a
 * aplicação em loop sem que houvesse nada de errado com ela.
 * `readiness` responde "posso receber tráfego?" e aí sim depende do banco.
 */
export class HealthService {
  async liveness() {
    const runtime = getRuntimeInfo();
    return {
      state: "healthy" as const,
      pid: process.pid,
      uptimeSeconds: Math.floor(process.uptime()),
      startedAt: runtime.startedAt?.toISOString() ?? null,
    };
  }

  async readiness(): Promise<{ state: HealthState; checks: CheckResult[] }> {
    const db = await this.checkDatabase();
    return {
      state: db.state === "healthy" ? "healthy" : "unhealthy",
      checks: [db],
    };
  }

  async full(): Promise<HealthReport> {
    const runtime = getRuntimeInfo();

    const checks: CheckResult[] = [
      await this.checkDatabase(),
      await this.checkQueue(),
      this.checkScheduler(),
      this.checkProviders(),
      this.checkMemory(),
    ];

    return {
      state: this.aggregate(checks),
      version: process.env.npm_package_version ?? "0.1.0",
      environment: this.safeEnv(),
      uptimeSeconds: Math.floor(process.uptime()),
      startedAt: runtime.startedAt?.toISOString() ?? null,
      checkedAt: new Date().toISOString(),
      checks,
    };
  }

  // -------------------------------------------------------------------------

  private async checkDatabase(): Promise<CheckResult> {
    try {
      const latencyMs = await pingDatabase();
      return {
        name: "database",
        state: latencyMs > 1000 ? "degraded" : "healthy",
        latencyMs,
        message:
          latencyMs > 1000 ? "Latência acima do esperado" : "PostgreSQL respondendo",
      };
    } catch (e) {
      return {
        name: "database",
        state: "unhealthy",
        message: normalizeError(e).message,
      };
    }
  }

  private async checkQueue(): Promise<CheckResult> {
    try {
      const stats = await queueService.stats();
      const workers = workerStatus();

      // Fila crescendo sem worker vivo é a falha silenciosa clássica.
      const stuck = stats.depth > 0 && workers.length === 0;
      const backlog = stats.depth > 500;

      return {
        name: "queue",
        state: stuck || backlog ? "degraded" : "healthy",
        message: stuck
          ? "Há jobs pendentes e nenhum worker ativo neste processo"
          : backlog
            ? "Backlog acima do esperado"
            : "Fila saudável",
        details: {
          depth: stats.depth,
          counts: stats.counts,
          oldestPendingAt: stats.oldestPendingAt,
          workers,
          handlersRegistrados: handlerRegistry.list().length,
        },
      };
    } catch (e) {
      return {
        name: "queue",
        state: "unhealthy",
        message: normalizeError(e).message,
      };
    }
  }

  private checkScheduler(): CheckResult {
    const status = scheduler.status;
    return {
      name: "scheduler",
      state: "healthy",
      message: status.running ? "Scheduler ativo" : "Scheduler não ativo neste processo",
      details: {
        ...status,
        lastTickAt: status.lastTickAt?.toISOString() ?? null,
      },
    };
  }

  private checkProviders(): CheckResult {
    const providers = providerRegistry.describe();
    return {
      name: "providers",
      state: "healthy",
      message: `${providers.length} conector(es) registrado(s)`,
      details: { providers },
    };
  }

  private checkMemory(): CheckResult {
    const { heapUsed, heapTotal, rss } = process.memoryUsage();
    const ratio = heapUsed / heapTotal;
    return {
      name: "memory",
      state: ratio > 0.92 ? "degraded" : "healthy",
      details: {
        rssMb: Math.round(rss / 1024 / 1024),
        heapUsedMb: Math.round(heapUsed / 1024 / 1024),
        heapTotalMb: Math.round(heapTotal / 1024 / 1024),
        heapUsage: `${Math.round(ratio * 100)}%`,
      },
    };
  }

  private aggregate(checks: CheckResult[]): HealthState {
    if (checks.some((c) => c.state === "unhealthy")) return "unhealthy";
    if (checks.some((c) => c.state === "degraded")) return "degraded";
    return "healthy";
  }

  private safeEnv() {
    try {
      return loadEnv().NODE_ENV;
    } catch {
      return "unknown";
    }
  }
}

export const healthService = new HealthService();
