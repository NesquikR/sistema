"use client";

import { motion } from "framer-motion";
import { CalendarClock, Clock3, Pause, Play, Send, X } from "lucide-react";
import { PageShell, PageTitle } from "@/components/layout/page-shell";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tooltip } from "@/components/ui/controls";
import { DealThumb } from "@/components/deals/thumb";
import { deals } from "@/data/deals";
import { storeById } from "@/data/stores";
import { categoryById } from "@/data/categories";
import { clockOf, money } from "@/lib/utils";

/** Janelas de publicação configuradas — refletem os picos de audiência. */
const windows = [
  { label: "Manhã", range: "08:00 – 10:00", load: 3, capacity: 6 },
  { label: "Almoço", range: "12:00 – 13:30", load: 5, capacity: 6 },
  { label: "Tarde", range: "16:00 – 17:30", load: 2, capacity: 6 },
  { label: "Pico noturno", range: "19:00 – 21:00", load: 6, capacity: 8 },
];

export default function AgendadasPage() {
  const scheduled = deals
    .filter((d) => d.status === "agendada")
    .sort(
      (a, b) =>
        new Date(a.scheduledFor!).getTime() - new Date(b.scheduledFor!).getTime(),
    );

  return (
    <PageShell>
      <PageTitle
        title="Agendadas"
        subtitle="Fila de publicação futura. As ofertas são liberadas automaticamente dentro da janela escolhida."
        actions={
          <>
            <Button variant="secondary" size="sm">
              <Pause className="h-3.5 w-3.5" strokeWidth={2} />
              Pausar fila
            </Button>
            <Button variant="primary" size="sm">
              <Play className="h-3.5 w-3.5" strokeWidth={2.2} />
              Publicar tudo agora
            </Button>
          </>
        }
      />

      <div className="mb-5 grid grid-cols-2 gap-3.5 lg:grid-cols-4">
        {windows.map((w) => {
          const full = w.load >= w.capacity;
          return (
            <div
              key={w.label}
              className="rounded-[14px] border border-line bg-[linear-gradient(180deg,#ffffff06,#ffffff02)] px-4 py-3.5 backdrop-blur-xl"
            >
              <div className="flex items-center justify-between">
                <p className="text-[12px] font-medium text-fg">{w.label}</p>
                <Badge tone={full ? "warn" : "neutral"}>
                  {w.load}/{w.capacity}
                </Badge>
              </div>
              <p className="num mt-2 text-[16px] font-semibold tracking-[-0.02em] text-fg-muted">
                {w.range}
              </p>
              <div className="mt-3 flex gap-1">
                {Array.from({ length: w.capacity }).map((_, i) => (
                  <span
                    key={i}
                    className="h-1 flex-1 rounded-full"
                    style={{
                      background: i < w.load ? (full ? "#fbbf24" : "#8b5cf6") : "#ffffff12",
                    }}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <Card glow>
        <CardHeader
          title="Linha do tempo de publicação"
          subtitle="Ordenada pelo horário programado"
          action={
            <span className="num text-[12px] text-fg-subtle">{scheduled.length} agendamentos</span>
          }
        />
        <CardBody>
          <div className="relative">
            <span className="absolute bottom-4 left-[58px] top-4 w-px bg-[linear-gradient(180deg,#ffffff18,#ffffff05)]" />

            {scheduled.map((d, i) => (
              <motion.div
                key={d.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.36, delay: i * 0.06, ease: [0.22, 1, 0.36, 1] }}
                className="group relative flex items-start gap-4 py-2.5"
              >
                <div className="w-[46px] shrink-0 pt-3.5 text-right">
                  <p className="num text-[13px] font-semibold text-fg">
                    {clockOf(d.scheduledFor!)}
                  </p>
                  <p className="text-[10.5px] text-fg-subtle">hoje</p>
                </div>

                <span className="relative z-10 mt-4 h-2.5 w-2.5 shrink-0 rounded-full border-2 border-base bg-violet shadow-[0_0_12px_-2px_#8b5cf6]" />

                <div className="min-w-0 flex-1 rounded-[14px] border border-line bg-black/20 p-3.5 transition-colors duration-200 hover:border-white/[0.13]">
                  <div className="flex flex-wrap items-center gap-3.5">
                    <DealThumb deal={d} size={52} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13.5px] font-medium text-fg">{d.title}</p>
                      <p className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[11.5px] text-fg-subtle">
                        <span>{storeById[d.store].name}</span>
                        <span className="h-2.5 w-px bg-line-strong" />
                        <span>
                          {categoryById[d.category].emoji} {categoryById[d.category].name}
                        </span>
                        <span className="h-2.5 w-px bg-line-strong" />
                        <span className="font-mono text-cyan">{d.channel}</span>
                      </p>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <p className="num text-[15px] font-semibold tracking-[-0.02em] text-fg">
                          {money(d.price)}
                        </p>
                        <p className="num text-[11px] text-fg-subtle line-through">
                          {money(d.previousPrice)}
                        </p>
                      </div>
                      <Badge tone="pink">−{d.discount}%</Badge>
                    </div>

                    <div className="flex items-center gap-1.5 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
                      <Tooltip content="Publicar imediatamente">
                        <Button size="icon" variant="secondary" aria-label="Publicar agora">
                          <Send className="h-3.5 w-3.5" strokeWidth={2} />
                        </Button>
                      </Tooltip>
                      <Tooltip content="Reagendar">
                        <Button size="icon" variant="ghost" aria-label="Reagendar">
                          <CalendarClock className="h-3.5 w-3.5" strokeWidth={2} />
                        </Button>
                      </Tooltip>
                      <Tooltip content="Cancelar agendamento">
                        <Button size="icon" variant="ghost" aria-label="Cancelar">
                          <X className="h-3.5 w-3.5" strokeWidth={2} />
                        </Button>
                      </Tooltip>
                    </div>
                  </div>

                  <p className="mt-2.5 flex items-center gap-1.5 text-[11.5px] text-fg-subtle">
                    <Clock3 className="h-3 w-3" strokeWidth={2} />
                    {d.aiVerdict}
                  </p>
                </div>
              </motion.div>
            ))}
          </div>
        </CardBody>
      </Card>
    </PageShell>
  );
}
