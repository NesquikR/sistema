"use client";

import * as React from "react";
import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle, Bot, Radio, Search, Send, Settings2 } from "lucide-react";
import { activity } from "@/data/logs";
import { clockOf, cn } from "@/lib/utils";
import type { ActivityEvent } from "@/types";

const styles: Record<
  ActivityEvent["kind"],
  { icon: React.ElementType; color: string; label: string }
> = {
  busca: { icon: Search, color: "#3b82f6", label: "BUSCA" },
  ia: { icon: Bot, color: "var(--color-primary)", label: "IA" },
  telegram: { icon: Send, color: "var(--color-primary)", label: "TELEGRAM" },
  sistema: { icon: Settings2, color: "#6b7280", label: "SISTEMA" },
  erro: { icon: AlertTriangle, color: "#fb7185", label: "ERRO" },
};

export function ActivityStream() {
  // Revela os eventos progressivamente, como um terminal ao vivo.
  const [visible, setVisible] = React.useState(4);

  React.useEffect(() => {
    if (visible >= activity.length) return;
    const t = setTimeout(() => setVisible((v) => v + 1), 1600);
    return () => clearTimeout(t);
  }, [visible]);

  const items = activity.slice(0, visible);

  return (
    <div className="relative">
      <div className="flex items-center gap-2 px-5 pb-3">
        <Radio className="h-3.5 w-3.5 text-ok" strokeWidth={2} />
        <span className="text-[11px] font-medium uppercase tracking-[0.14em] text-fg-subtle">
          Fluxo ao vivo
        </span>
        <span className="ml-auto num text-[11px] text-fg-subtle">
          {activity.length} eventos · 30 min
        </span>
      </div>

      <div className="relative max-h-[420px] overflow-y-auto px-5 pb-5">
        {/* trilho vertical */}
        <span className="absolute bottom-6 left-[35px] top-1 w-px bg-surface" />

        <AnimatePresence initial={false}>
          {items.map((e) => {
            const s = styles[e.kind];
            const Icon = s.icon;
            return (
              <motion.div
                key={e.id}
                layout
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
                className="group relative flex gap-3 py-2.5"
              >
                <span className="num w-[38px] shrink-0 pt-[3px] text-right text-[11px] text-fg-subtle">
                  {clockOf(e.ts)}
                </span>
                <span
                  className="relative z-10 mt-[1px] flex h-6 w-6 shrink-0 items-center justify-center rounded-[8px] border transition-transform duration-200 group-hover:scale-105"
                  style={{
                    borderColor: `${s.color}33`,
                    background: `${s.color}14`,
                  }}
                >
                  <Icon className="h-3 w-3" style={{ color: s.color }} strokeWidth={2.1} />
                </span>
                <div className="min-w-0 flex-1 pt-[1px]">
                  <p className="flex items-center gap-2 text-[12.5px] font-medium text-fg">
                    {e.title}
                    <span
                      className="rounded px-1 py-[1px] font-mono text-[9px] tracking-wider"
                      style={{ color: s.color, background: `${s.color}12` }}
                    >
                      {s.label}
                    </span>
                  </p>
                  <p className="mt-0.5 truncate font-mono text-[11.5px] text-fg-subtle">
                    {e.detail}
                  </p>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>

        {visible < activity.length && (
          <div className="flex items-center gap-3 py-2.5 pl-[50px]">
            <span className="flex gap-1">
              {[0, 1, 2].map((i) => (
                <motion.span
                  key={i}
                  className="h-1 w-1 rounded-full bg-violet-soft"
                  animate={{ opacity: [0.25, 1, 0.25] }}
                  transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.18 }}
                />
              ))}
            </span>
            <span className={cn("font-mono text-[11px] text-fg-subtle")}>
              aguardando próximo evento…
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
