"use client";

import * as React from "react";
import { Search } from "lucide-react";
import { cn } from "@/lib/utils";

export const Input = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(({ className, ...props }, ref) => (
  <input
    ref={ref}
    className={cn(
      "h-9 w-full rounded border border-line-strong bg-surface-2 px-3 text-[13px] text-fg",
      "placeholder:text-fg-subtle transition-colors duration-150",
      "hover:border-fg-subtle focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/30",
      className,
    )}
    {...props}
  />
));
Input.displayName = "Input";

export function SearchInput({
  className,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className={cn("relative", className)}>
      <Search
        className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-fg-subtle"
        strokeWidth={2}
      />
      <Input className="pl-9" {...props} />
    </div>
  );
}

export function Select({
  className,
  children,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cn(
        "h-9 appearance-none rounded border border-line-strong bg-surface-2 px-3 pr-8 text-[13px] text-fg",
        "bg-[url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2212%22 height=%2212%22 fill=%22none%22 stroke=%22%239ca3af%22 stroke-width=%222%22><path d=%22M2 4l4 4 4-4%22/></svg>')] bg-[length:12px] bg-[right_10px_center] bg-no-repeat",
        "transition-colors duration-150 hover:border-fg-subtle focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/30",
        className,
      )}
      {...props}
    >
      {children}
    </select>
  );
}

export function Switch({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative h-[22px] w-[38px] shrink-0 rounded-full border transition-colors duration-200",
        checked
          ? "border-primary bg-primary"
          : "border-line-strong bg-surface-2",
      )}
    >
      <span
        className={cn(
          "absolute top-1/2 h-[16px] w-[16px] -translate-y-1/2 rounded-full bg-white transition-all duration-200",
          checked ? "left-[19px]" : "left-[2px] opacity-70",
        )}
      />
    </button>
  );
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  className,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "inline-flex items-center gap-0.5 rounded border border-line bg-surface-2 p-0.5",
        className,
      )}
    >
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            "relative rounded px-2.5 py-1 text-[12px] font-medium transition-colors duration-150",
            value === o.value
              ? "bg-base text-fg shadow-sm"
              : "text-fg-subtle hover:text-fg-muted",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Tooltip({
  content,
  children,
  side = "top",
}: {
  content: React.ReactNode;
  children: React.ReactNode;
  side?: "top" | "bottom";
}) {
  return (
    <span className="group/tt relative inline-flex">
      {children}
      <span
        className={cn(
          "pointer-events-none absolute left-1/2 z-50 -translate-x-1/2 whitespace-nowrap rounded border border-line-strong bg-elevated px-2 py-1 text-[11px] text-fg-muted opacity-0 shadow-lg transition-all duration-150 group-hover/tt:opacity-100",
          side === "top"
            ? "bottom-full mb-2 translate-y-1 group-hover/tt:translate-y-0"
            : "top-full mt-2 -translate-y-1 group-hover/tt:translate-y-0",
        )}
      >
        {content}
      </span>
    </span>
  );
}

export function Progress({
  value,
  tone,
  className,
}: {
  value: number;
  tone?: string;
  className?: string;
}) {
  const barColor = tone || "var(--color-primary)";
  return (
    <div className={cn("h-1.5 w-full overflow-hidden rounded-full bg-surface-2", className)}>
      <div
        className="h-full rounded-full transition-[width] duration-700 ease-out"
        style={{
          width: `${Math.min(100, Math.max(0, value))}%`,
          background: barColor,
        }}
      />
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "animate-pulse rounded bg-surface-2",
        className,
      )}
    />
  );
}
