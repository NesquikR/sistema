import * as React from "react";
import { cn } from "@/lib/utils";

export function Card({
  className,
  glow,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { glow?: boolean }) {
  return (
    <div
      className={cn(
        "relative rounded-[18px] border border-line bg-[linear-gradient(180deg,#ffffff07,#ffffff02)] backdrop-blur-xl",
        "shadow-[0_1px_0_0_#ffffff0a_inset,0_24px_48px_-32px_#000]",
        glow &&
          "before:pointer-events-none before:absolute before:inset-x-8 before:-top-px before:h-px before:bg-[linear-gradient(90deg,transparent,#a78bfa66,transparent)]",
        className,
      )}
      {...props}
    />
  );
}

export function CardHeader({
  title,
  subtitle,
  action,
  className,
}: {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex items-start justify-between gap-4 px-5 pt-5", className)}>
      <div className="min-w-0">
        <h3 className="text-[13.5px] font-medium tracking-[-0.01em] text-fg">{title}</h3>
        {subtitle && (
          <p className="mt-1 text-[12px] leading-relaxed text-fg-subtle">{subtitle}</p>
        )}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

export function CardBody({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("px-5 pb-5 pt-4", className)} {...props} />;
}

export function Divider({ className }: { className?: string }) {
  return <div className={cn("h-px w-full bg-line", className)} />;
}
