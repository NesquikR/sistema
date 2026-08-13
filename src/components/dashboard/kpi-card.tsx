"use client";

import * as React from "react";
import { motion, useMotionValue, useSpring, useTransform } from "framer-motion";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Sparkline } from "@/components/charts";

export interface Kpi {
  label: string;
  value: string;
  delta: number;
  hint: string;
  color: string;
  series: number[];
  invertDelta?: boolean;
}

export function KpiCard({ kpi }: { kpi: Kpi }) {
  const ref = React.useRef<HTMLDivElement>(null);
  const mx = useMotionValue(0.5);
  const my = useMotionValue(0.5);
  const rx = useSpring(useTransform(my, [0, 1], [3.5, -3.5]), { stiffness: 220, damping: 22 });
  const ry = useSpring(useTransform(mx, [0, 1], [-3.5, 3.5]), { stiffness: 220, damping: 22 });

  const positive = kpi.invertDelta ? kpi.delta < 0 : kpi.delta > 0;
  const Arrow = kpi.delta >= 0 ? ArrowUpRight : ArrowDownRight;

  return (
    <motion.div
      ref={ref}
      onMouseMove={(e) => {
        const r = ref.current?.getBoundingClientRect();
        if (!r) return;
        mx.set((e.clientX - r.left) / r.width);
        my.set((e.clientY - r.top) / r.height);
      }}
      onMouseLeave={() => {
        mx.set(0.5);
        my.set(0.5);
      }}
      style={{ rotateX: rx, rotateY: ry, transformPerspective: 900 }}
      className="group relative overflow-hidden rounded-[18px] border border-line bg-[linear-gradient(180deg,#ffffff07,#ffffff02)] p-5 backdrop-blur-xl transition-colors duration-200 hover:border-white/[0.12]"
    >
      {/* brilho superior no hover */}
      <span
        className="pointer-events-none absolute inset-x-6 -top-px h-px opacity-0 transition-opacity duration-300 group-hover:opacity-100"
        style={{ background: `linear-gradient(90deg,transparent,${kpi.color}99,transparent)` }}
      />

      <div className="flex items-start justify-between gap-3">
        <p className="text-[12px] font-medium text-fg-muted">{kpi.label}</p>
        <span
          className={cn(
            "num inline-flex items-center gap-0.5 rounded-full border px-1.5 py-[2px] text-[11px] font-semibold",
            positive
              ? "border-ok/25 bg-ok/10 text-ok"
              : "border-danger/25 bg-danger/10 text-danger",
          )}
        >
          <Arrow className="h-3 w-3" strokeWidth={2.4} />
          {Math.abs(kpi.delta).toFixed(1).replace(".", ",")}%
        </span>
      </div>

      <p className="num mt-3 text-[27px] font-semibold leading-none tracking-[-0.035em] text-fg">
        {kpi.value}
      </p>
      <p className="mt-2 text-[11.5px] leading-relaxed text-fg-subtle">{kpi.hint}</p>

      <div className="-mx-1 mt-3 opacity-70 transition-opacity duration-300 group-hover:opacity-100">
        <Sparkline data={kpi.series} color={kpi.color} height={34} />
      </div>
    </motion.div>
  );
}
