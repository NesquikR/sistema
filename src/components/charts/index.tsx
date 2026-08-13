"use client";

import * as React from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const axis = {
  stroke: "#ffffff14",
  tick: { fill: "#6b7280", fontSize: 11 },
  tickLine: false,
  axisLine: false,
};

function ChartTooltip({
  active,
  payload,
  label,
  formatter,
}: {
  active?: boolean;
  payload?: { name: string; value: number; color?: string; stroke?: string }[];
  label?: string;
  formatter?: (v: number, name: string) => string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-[10px] border border-line-strong bg-elevated/95 px-3 py-2 shadow-[0_20px_40px_-20px_#000] backdrop-blur-xl">
      {label && (
        <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wider text-fg-subtle">
          {label}
        </p>
      )}
      <div className="space-y-1">
        {payload.map((p) => (
          <div key={p.name} className="flex items-center gap-2 text-[12px]">
            <span
              className="h-1.5 w-1.5 rounded-full"
              style={{ background: p.color ?? p.stroke ?? "#8b5cf6" }}
            />
            <span className="text-fg-muted">{p.name}</span>
            <span className="num ml-auto font-medium text-fg">
              {formatter ? formatter(p.value, p.name) : p.value.toLocaleString("pt-BR")}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function AreaTrend<T extends object>({
  data,
  xKey,
  series,
  height = 220,
  formatter,
}: {
  data: T[];
  xKey: string;
  series: { key: string; name: string; color: string }[];
  height?: number;
  formatter?: (v: number, name: string) => string;
}) {
  const id = React.useId().replace(/:/g, "");
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 6, right: 6, left: -18, bottom: 0 }}>
        <defs>
          {series.map((s, i) => (
            <linearGradient key={s.key} id={`${id}-${i}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={s.color} stopOpacity={0.32} />
              <stop offset="100%" stopColor={s.color} stopOpacity={0} />
            </linearGradient>
          ))}
        </defs>
        <CartesianGrid stroke="#ffffff0a" vertical={false} />
        <XAxis dataKey={xKey} {...axis} interval="preserveStartEnd" minTickGap={24} />
        <YAxis {...axis} width={52} />
        <Tooltip
          cursor={{ stroke: "#ffffff22", strokeWidth: 1 }}
          content={<ChartTooltip formatter={formatter} />}
        />
        {series.map((s, i) => (
          <Area
            key={s.key}
            type="monotone"
            dataKey={s.key}
            name={s.name}
            stroke={s.color}
            strokeWidth={1.8}
            fill={`url(#${id}-${i})`}
            dot={false}
            activeDot={{ r: 3.5, strokeWidth: 0 }}
          />
        ))}
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function Bars<T extends object>({
  data,
  xKey,
  series,
  height = 220,
  formatter,
  layout = "horizontal",
}: {
  data: T[];
  xKey: string;
  series: { key: string; name: string; color: string }[];
  height?: number;
  formatter?: (v: number, name: string) => string;
  layout?: "horizontal" | "vertical";
}) {
  const vertical = layout === "vertical";
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart
        data={data}
        layout={layout}
        margin={{ top: 6, right: 10, left: vertical ? 8 : -18, bottom: 0 }}
        barCategoryGap={vertical ? "24%" : "34%"}
      >
        <CartesianGrid stroke="#ffffff0a" vertical={vertical} horizontal={!vertical} />
        {vertical ? (
          <>
            <XAxis type="number" {...axis} />
            <YAxis type="category" dataKey={xKey} {...axis} width={104} />
          </>
        ) : (
          <>
            <XAxis dataKey={xKey} {...axis} interval="preserveStartEnd" minTickGap={20} />
            <YAxis {...axis} width={52} />
          </>
        )}
        <Tooltip
          cursor={{ fill: "#ffffff08" }}
          content={<ChartTooltip formatter={formatter} />}
        />
        {series.map((s) => (
          <Bar
            key={s.key}
            dataKey={s.key}
            name={s.name}
            fill={s.color}
            radius={vertical ? [0, 5, 5, 0] : [5, 5, 0, 0]}
            maxBarSize={vertical ? 16 : 30}
          />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}

export function Donut({
  data,
  height = 220,
  center,
}: {
  data: { label: string; value: number; color: string }[];
  height?: number;
  center?: { value: string; label: string };
}) {
  return (
    <div className="relative">
      <ResponsiveContainer width="100%" height={height}>
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            nameKey="label"
            innerRadius="66%"
            outerRadius="92%"
            paddingAngle={3}
            stroke="none"
          >
            {data.map((d) => (
              <Cell key={d.label} fill={d.color} />
            ))}
          </Pie>
          <Tooltip content={<ChartTooltip />} />
        </PieChart>
      </ResponsiveContainer>
      {center && (
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="num text-[22px] font-semibold tracking-[-0.02em] text-fg">
            {center.value}
          </span>
          <span className="text-[11px] text-fg-subtle">{center.label}</span>
        </div>
      )}
    </div>
  );
}

export function Sparkline({
  data,
  color = "#8b5cf6",
  height = 36,
}: {
  data: number[];
  color?: string;
  height?: number;
}) {
  const shaped = data.map((v, i) => ({ i, v }));
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={shaped} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
        <Line
          type="monotone"
          dataKey="v"
          stroke={color}
          strokeWidth={1.6}
          dot={false}
          isAnimationActive={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

