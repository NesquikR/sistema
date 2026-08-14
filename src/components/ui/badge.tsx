import * as React from "react";
import { cn } from "@/lib/utils";

type Tone = "neutral" | "primary" | "blue" | "ok" | "warn" | "danger";

const tones: Record<Tone, string> = {
  neutral: "bg-surface-2 text-fg-muted border-line-strong",
  primary: "bg-primary-bg text-primary border-primary/20",
  blue: "bg-[#eff6ff] text-[#2563eb] border-[#2563eb]/20 dark:bg-[#172554] dark:text-[#60a5fa] dark:border-[#60a5fa]/20",
  ok: "bg-ok/10 text-ok border-ok/20",
  warn: "bg-warn/10 text-warn border-warn/20",
  danger: "bg-danger/10 text-danger border-danger/20",
};

export function Badge({
  tone = "neutral",
  className,
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & { tone?: Tone }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded border px-2 py-[3px] text-[11px] font-medium leading-none",
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
      ? "var(--color-ok)"
      : tone === "warn"
        ? "var(--color-warn)"
        : tone === "danger"
          ? "var(--color-danger)"
          : "var(--color-fg-subtle)";
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
        style={{ background: color }}
      />
    </span>
  );
}
