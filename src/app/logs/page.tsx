"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { ChevronRight, Download, Pause, Play } from "lucide-react";
import { PageShell, PageTitle } from "@/components/layout/page-shell";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Badge, StatusDot } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SearchInput, Segmented, Select } from "@/components/ui/controls";
import { Bars } from "@/components/charts";
import { logs } from "@/data/logs";
import { NOW } from "@/data/stores";
import { cn, dateTimeOf, int, relativeTime } from "@/lib/utils";
import type { LogLevel } from "@/types";

const levelMeta: Record<LogLevel, { color: string; label: string }> = {
  sucesso: { color: "#34d399", label: "SUCESSO" },
  info: { color: "#3b82f6", label: "INFO" },
  aviso: { color: "#fbbf24", label: "AVISO" },
  erro: { color: "#fb7185", label: "ERRO" },
  debug: { color: "#6b7280", label: "DEBUG" },
};

/** Volume de eventos por minuto — histograma do topo, estilo Grafana. */
const histogram = Array.from({ length: 30 }, (_, i) => ({
  t: `${59 - i}m`,
  erro: i % 9 === 0 ? 1 : 0,
  aviso: i % 5 === 0 ? 1 : 0,
  info: 2 + ((i * 7) % 4),
})).reverse();

export default function LogsPage() {
  const [q, setQ] = React.useState("");
  const [level, setLevel] = React.useState("todos");
  const [source, setSource] = React.useState("todas");
  const [live, setLive] = React.useState(true);
  const [open, setOpen] = React.useState<string | null>(null);

  const sources = Array.from(new Set(logs.map((l) => l.source))).sort();

  const rows = logs.filter((l) => {
    const term = q.trim().toLowerCase();
    if (term && !`${l.message} ${l.source} ${l.id}`.toLowerCase().includes(term)) return false;
    if (level !== "todos" && l.level !== level) return false;
    if (source !== "todas" && l.source !== source) return false;
    return true;
  });

  const counts = (Object.keys(levelMeta) as LogLevel[]).map((lv) => ({
    level: lv,
    count: logs.filter((l) => l.level === lv).length,
  }));

  return (
    <PageShell>
      <PageTitle
        title="Logs"
        subtitle="Registro estruturado de tudo que o motor executa — conectores, IA, filas e publicação."
        actions={
          <>
            <Button variant="secondary" size="sm" onClick={() => setLive((v) => !v)}>
              {live ? (
                <>
                  <Pause className="h-3.5 w-3.5" strokeWidth={2} /> Pausar stream
                </>
              ) : (
                <>
                  <Play className="h-3.5 w-3.5" strokeWidth={2} /> Retomar stream
                </>
              )}
            </Button>
            <Button variant="secondary" size="sm">
              <Download className="h-3.5 w-3.5" strokeWidth={2} />
              Exportar
            </Button>
          </>
        }
      />

      <div className="mb-5 grid grid-cols-2 gap-3.5 lg:grid-cols-5">
        {counts.map((c) => (
          <div
            key={c.level}
            className="rounded-[14px] border border-line bg-surface px-4 py-3.5 "
          >
            <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.1em]">
              <span
                className="h-1.5 w-1.5 rounded-full"
                style={{ background: levelMeta[c.level].color }}
              />
              <span style={{ color: levelMeta[c.level].color }}>{levelMeta[c.level].label}</span>
            </p>
            <p className="num mt-2 text-[20px] font-semibold leading-none tracking-[-0.03em] text-fg">
              {int(c.count)}
            </p>
            <p className="mt-1.5 text-[11px] text-fg-subtle">última hora</p>
          </div>
        ))}
      </div>

      <Card className="mb-5">
        <CardHeader
          title="Volume de eventos"
          subtitle="Últimos 30 minutos, agregados por minuto"
          action={
            <span className="flex items-center gap-2 text-[11.5px] text-fg-subtle">
              <StatusDot tone={live ? "ok" : "neutral"} pulse={live} />
              {live ? "stream ativo" : "stream pausado"}
            </span>
          }
        />
        <CardBody>
          <Bars
            data={histogram}
            xKey="t"
            height={128}
            series={[
              { key: "info", name: "Info", color: "#3b82f6" },
              { key: "aviso", name: "Aviso", color: "#fbbf24" },
              { key: "erro", name: "Erro", color: "#fb7185" },
            ]}
          />
        </CardBody>
      </Card>

      <Card className="overflow-hidden">
        <div className="flex flex-wrap items-center gap-2.5 p-5 pb-4">
          <SearchInput
            className="w-full sm:w-[320px]"
            placeholder="Filtrar por mensagem, origem ou ID…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <Segmented
            value={level}
            onChange={setLevel}
            options={[
              { value: "todos", label: "Todos" },
              { value: "erro", label: "Erro" },
              { value: "aviso", label: "Aviso" },
              { value: "info", label: "Info" },
              { value: "debug", label: "Debug" },
            ]}
          />
          <Select value={source} onChange={(e) => setSource(e.target.value)}>
            <option value="todas">Todas as origens</option>
            {sources.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </Select>
          <span className="num ml-auto text-[12px] text-fg-subtle">
            {rows.length} de {logs.length} eventos
          </span>
        </div>

        <div className="border-t border-line font-mono text-[12px]">
          {rows.map((l, i) => {
            const meta = levelMeta[l.level];
            const expanded = open === l.id;
            return (
              <motion.div
                key={l.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.2, delay: Math.min(i * 0.012, 0.25) }}
                className={cn(
                  "group border-b border-line/60 transition-colors duration-150 hover:bg-white/[0.028]",
                  expanded && "bg-white/[0.03]",
                )}
              >
                <button
                  onClick={() => setOpen(expanded ? null : l.id)}
                  className="flex w-full items-start gap-3 px-5 py-2 text-left"
                >
                  <ChevronRight
                    className={cn(
                      "mt-[3px] h-3 w-3 shrink-0 text-fg-subtle transition-transform duration-200",
                      expanded && "rotate-90",
                    )}
                    strokeWidth={2.2}
                  />
                  <span className="num w-[104px] shrink-0 text-fg-subtle">
                    {dateTimeOf(l.ts)}
                  </span>
                  <span
                    className="w-[62px] shrink-0 text-[10px] font-bold tracking-wider"
                    style={{ color: meta.color }}
                  >
                    {meta.label}
                  </span>
                  <span className="w-[168px] shrink-0 truncate text-primary/80">
                    {l.source}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-fg-muted">{l.message}</span>
                  {l.durationMs !== undefined && (
                    <span className="num hidden shrink-0 text-fg-subtle sm:block">
                      {int(l.durationMs)} ms
                    </span>
                  )}
                </button>

                {expanded && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
                    className="overflow-hidden px-5 pb-3.5 pl-[46px]"
                  >
                    <div className="rounded-[10px] border border-line bg-surface-2 p-3.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge tone="neutral">{l.id}</Badge>
                        <Badge tone="primary">{l.source}</Badge>
                        <Badge tone="neutral">{relativeTime(l.ts, NOW)}</Badge>
                      </div>
                      <pre className="mt-3 whitespace-pre-wrap text-[11.5px] leading-relaxed text-fg-muted">
{JSON.stringify(
  {
    id: l.id,
    timestamp: l.ts,
    level: l.level,
    source: l.source,
    message: l.message,
    duration_ms: l.durationMs ?? null,
    ...(l.meta ?? {}),
  },
  null,
  2,
)}
                      </pre>
                    </div>
                  </motion.div>
                )}
              </motion.div>
            );
          })}

          {rows.length === 0 && (
            <p className="px-5 py-16 text-center text-[12.5px] text-fg-subtle">
              Nenhum evento corresponde aos filtros aplicados.
            </p>
          )}
        </div>
      </Card>
    </PageShell>
  );
}
