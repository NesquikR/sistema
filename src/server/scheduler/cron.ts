import { CronExpressionParser } from "cron-parser";
import { ConfigError } from "@/server/core/errors";

/**
 * Cálculo de próxima execução.
 *
 * O timezone é sempre explícito: o Brasil já teve horário de verão e pode ter
 * de novo. Um cron de "20h" que silenciosamente vira 19h ou 21h publicaria no
 * horário errado durante meses antes de alguém notar.
 */
export function nextRunAt(
  expression: string,
  timezone = "America/Sao_Paulo",
  from: Date = new Date(),
): Date {
  try {
    const interval = CronExpressionParser.parse(expression, {
      currentDate: from,
      tz: timezone,
    });
    return interval.next().toDate();
  } catch (e) {
    throw new ConfigError(
      `Expressão cron inválida "${expression}": ${(e as Error).message}`,
    );
  }
}

export function isValidCron(expression: string, timezone = "America/Sao_Paulo"): boolean {
  try {
    CronExpressionParser.parse(expression, { tz: timezone });
    return true;
  } catch {
    return false;
  }
}

/** Próximas N execuções — útil para pré-visualizar um agendamento na interface. */
export function upcomingRuns(
  expression: string,
  count = 5,
  timezone = "America/Sao_Paulo",
  from: Date = new Date(),
): Date[] {
  const interval = CronExpressionParser.parse(expression, {
    currentDate: from,
    tz: timezone,
  });
  return Array.from({ length: count }, () => interval.next().toDate());
}
