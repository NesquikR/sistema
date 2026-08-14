"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "success";
type Size = "sm" | "md" | "icon";

const variants: Record<Variant, string> = {
  primary:
    "bg-primary text-primary-fg border-primary hover:bg-primary-hover active:bg-primary-hover",
  secondary:
    "bg-transparent text-fg border-line-strong hover:bg-surface-2 hover:border-fg-subtle",
  ghost:
    "bg-transparent text-fg-muted border-transparent hover:bg-surface-2 hover:text-fg",
  danger:
    "bg-danger/10 text-danger border-danger/30 hover:bg-danger/20",
  success:
    "bg-ok/10 text-ok border-ok/30 hover:bg-ok/20",
};

const sizes: Record<Size, string> = {
  sm: "h-8 px-3 text-[12.5px] gap-1.5",
  md: "h-9 px-4 text-[13px] gap-2",
  icon: "h-8 w-8 justify-center",
};

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "secondary", size = "md", ...props }, ref) => (
    <button
      ref={ref}
      className={cn(
        "inline-flex cursor-pointer select-none items-center rounded border font-medium",
        "transition-colors duration-150",
        "disabled:pointer-events-none disabled:opacity-40",
        variants[variant],
        sizes[size],
        className,
      )}
      {...props}
    />
  ),
);
Button.displayName = "Button";
