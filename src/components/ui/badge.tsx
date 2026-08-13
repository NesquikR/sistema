import * as React from "react";
import { cn } from "@/lib/utils";

type Tone = "neutral" | "violet" | "pink" | "blue" | "ok" | "warn" | "danger";

const tones: Record<Tone, string> = {
  neutral: "bg-white/[0.05] text-fg-muted border-line-strong",
  violet: "bg-violet/12 text-violet-soft border-violet/25",
  pink: "bg-pink/12 text-pink border-pink/25",
  blue: "bg-blue/12 text-blue border-blue/25",
  ok: "bg-ok/12 text-ok border-ok/25",
  warn: "bg-warn/12 text-warn border-warn/25",
  danger: "bg-danger/12 text-danger border-danger/25",
};

export function Badge({
  tone = "neutral",
  className,
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & { tone?: Tone }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2 py-[3px] text-[11px] font-medium leading-none",
        tones[tone],
        className,
      )}
      {...props}
    />
  );
}

export function StatusDot({
  tone = "ok",
  pulse = true,
  className,
}: {
  tone?: "ok" | "warn" | "danger" | "neutral";
  pulse?: boolean;
  className?: string;
}) {
  const color =
    tone === "ok"
      ? "#34d399"
      : tone === "warn"
        ? "#fbbf24"
        : tone === "danger"
          ? "#fb7185"
          : "#6b7280";
  return (
    <span className={cn("relative flex h-[7px] w-[7px]", className)}>
      {pulse && (
        <span
          className="absolute inline-flex h-full w-full rounded-full opacity-60 animate-pulse-dot"
          style={{ background: color }}
        />
      )}
      <span
        className="relative inline-flex h-[7px] w-[7px] rounded-full"
        style={{ background: color, boxShadow: `0 0 10px ${color}80` }}
      />
    </span>
  );
}
