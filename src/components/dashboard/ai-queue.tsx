"use client";

import * as React from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  CalendarClock,
  Check,
  Sparkles,
  Star,
  Ticket,
  Truck,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tooltip } from "@/components/ui/controls";
import { DealThumb } from "@/components/deals/thumb";
import { Sparkline } from "@/components/charts";
import { aiQueue } from "@/data/deals";
import { categoryById } from "@/data/categories";
import { storeById } from "@/data/stores";
import { cn, int, money, relativeTime } from "@/lib/utils";
import { NOW } from "@/data/stores";
import type { Deal } from "@/types";

type Decision = "publicada" | "agendada" | "ignorada";

export function AiQueue() {
  const [queue, setQueue] = React.useState<Deal[]>(aiQueue);
  const [feedback, setFeedback] = React.useState<{ id: string; kind: Decision } | null>(null);

  function decide(deal: Deal, kind: Decision) {
    setFeedback({ id: deal.id, kind });
    setTimeout(() => {
      setQueue((q) => q.filter((d) => d.id !== deal.id));
      setFeedback(null);
    }, 340);
  }

  return (
    <div className="px-5 pb-5">
      <AnimatePresence mode="popLayout">
        {queue.map((deal) => (
          <motion.div
            key={deal.id}
            layout
            exit={{ opacity: 0, scale: 0.97, height: 0, marginBottom: 0 }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            className="mb-2.5 last:mb-0"
          >
            <QueueRow
              deal={deal}
              onDecide={decide}
              flash={feedback?.id === deal.id ? feedback.kind : null}
            />
          </motion.div>
        ))}
      </AnimatePresence>

      {queue.length === 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex flex-col items-center justify-center rounded-[14px] border border-dashed border-line-strong py-12 text-center"
        >
          <Check className="h-5 w-5 text-ok" strokeWidth={2} />
          <p className="mt-2.5 text-[13px] font-medium text-fg">Fila zerada</p>
          <p className="mt-1 text-[12px] text-fg-subtle">
            Todas as ofertas do ciclo foram avaliadas. Próxima varredura em 2 minutos.
          </p>
        </motion.div>
      )}
    </div>
  );
}

function QueueRow({
  deal,
  onDecide,
  flash,
}: {
  deal: Deal;
  onDecide: (d: Deal, k: Decision) => void;
  flash: Decision | null;
}) {
  const store = storeById[deal.store];
  const category = categoryById[deal.category];
  const belowAverage = Math.round(
    ((deal.averagePrice - deal.price) / deal.averagePrice) * 100,
  );

  return (
    <div
      className={cn(
        "group relative overflow-hidden rounded-[14px] border border-line bg-black/20 p-3.5 transition-all duration-200",
        "hover:border-white/[0.13] hover:bg-white/[0.03]",
        flash === "publicada" && "border-ok/40 bg-ok/[0.06]",
        flash === "agendada" && "border-blue/40 bg-blue/[0.06]",
        flash === "ignorada" && "border-danger/40 bg-danger/[0.06]",
      )}
    >
      <div className="flex gap-3.5">
        <DealThumb deal={deal} size={72} />

        <div className="min-w-0 flex-1">
          <div className="flex items-start gap-3">
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13.5px] font-medium leading-snug text-fg">
                {deal.title}
              </p>
              <div className="mt-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[11.5px] text-fg-subtle">
                <span className="font-medium text-fg-muted">{deal.brand}</span>
                <span className="h-2.5 w-px bg-line-strong" />
                <span className="flex items-center gap-1">
                  <span
                    className="h-1.5 w-1.5 rounded-full"
                    style={{ background: store.accent }}
                  />
                  {store.name}
                </span>
                <span className="h-2.5 w-px bg-line-strong" />
                <span>
                  {category.emoji} {category.name}
                </span>
                <span className="h-2.5 w-px bg-line-strong" />
                <span className="num flex items-center gap-1">
                  <Star className="h-3 w-3 fill-warn text-warn" />
                  {deal.rating.toFixed(1).replace(".", ",")} · {int(deal.reviews)}
                </span>
              </div>
            </div>

            <ScoreRing score={deal.aiScore} />
          </div>

          <div className="mt-3 flex flex-wrap items-end gap-x-5 gap-y-2">
            <div>
              <p className="num text-[19px] font-semibold leading-none tracking-[-0.03em] text-fg">
                {money(deal.price)}
              </p>
              <p className="num mt-1 text-[11.5px] text-fg-subtle">
                <span className="line-through">{money(deal.previousPrice)}</span>
                <span className="ml-1.5 text-fg-muted">
                  média {money(deal.averagePrice)}
                </span>
              </p>
            </div>

            <Badge tone="pink" className="mb-0.5">
              −{deal.discount}%
            </Badge>
            <Badge tone="violet" className="mb-0.5">
              {belowAverage}% abaixo da média
            </Badge>
            {deal.freeShipping && (
              <Badge tone="blue" className="mb-0.5">
                <Truck className="h-3 w-3" /> Frete grátis
              </Badge>
            )}
            {deal.coupon && (
              <Badge tone="warn" className="mb-0.5">
                <Ticket className="h-3 w-3" /> {deal.coupon}
              </Badge>
            )}

            <div className="ml-auto hidden w-[110px] opacity-60 transition-opacity group-hover:opacity-100 xl:block">
              <Sparkline data={deal.priceHistory} color="#a78bfa" height={30} />
            </div>
          </div>

          <p className="mt-3 flex items-start gap-2 rounded-[10px] border border-violet/15 bg-violet/[0.05] px-2.5 py-2 text-[11.5px] leading-relaxed text-fg-muted">
            <Sparkles className="mt-[1px] h-3 w-3 shrink-0 text-violet-soft" strokeWidth={2} />
            {deal.aiVerdict}
          </p>

          <div className="mt-3 flex items-center gap-2">
            <Button variant="primary" size="sm" onClick={() => onDecide(deal, "publicada")}>
              <Check className="h-3.5 w-3.5" strokeWidth={2.4} />
              Publicar
            </Button>
            <Button variant="secondary" size="sm" onClick={() => onDecide(deal, "agendada")}>
              <CalendarClock className="h-3.5 w-3.5" strokeWidth={2} />
              Agendar
            </Button>
            <Button variant="ghost" size="sm" onClick={() => onDecide(deal, "ignorada")}>
              <X className="h-3.5 w-3.5" strokeWidth={2} />
              Ignorar
            </Button>
            <Tooltip content={`Detectada ${relativeTime(deal.foundAt, NOW)}`}>
              <span className="num ml-auto text-[11px] text-fg-subtle">
                {deal.id} · {relativeTime(deal.foundAt, NOW)}
              </span>
            </Tooltip>
          </div>
        </div>
      </div>
    </div>
  );
}

function ScoreRing({ score }: { score: number }) {
  const r = 17;
  const c = 2 * Math.PI * r;
  const tone = score >= 85 ? "#34d399" : score >= 70 ? "#8b5cf6" : "#fbbf24";
  return (
    <Tooltip content="Score de confiança da IA">
      <span className="relative flex h-[42px] w-[42px] shrink-0 items-center justify-center">
        <svg className="absolute -rotate-90" width="42" height="42" viewBox="0 0 42 42">
          <circle cx="21" cy="21" r={r} fill="none" stroke="#ffffff12" strokeWidth="3" />
          <circle
            cx="21"
            cy="21"
            r={r}
            fill="none"
            stroke={tone}
            strokeWidth="3"
            strokeLinecap="round"
            strokeDasharray={c}
            strokeDashoffset={c - (c * score) / 100}
            style={{ transition: "stroke-dashoffset 900ms cubic-bezier(0.22,1,0.36,1)" }}
          />
        </svg>
        <span className="num text-[12.5px] font-semibold" style={{ color: tone }}>
          {score}
        </span>
      </span>
    </Tooltip>
  );
}
