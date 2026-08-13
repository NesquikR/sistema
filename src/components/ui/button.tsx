"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "success";
type Size = "sm" | "md" | "icon";

const variants: Record<Variant, string> = {
  primary:
    "bg-[linear-gradient(180deg,#8b5cf6,#7c3aed)] text-white border-violet/40 shadow-[0_1px_0_0_#ffffff33_inset,0_8px_24px_-12px_#8b5cf6cc] hover:brightness-110",
  secondary:
    "bg-white/[0.04] text-fg border-line-strong hover:bg-white/[0.07] hover:border-white/20",
  ghost: "bg-transparent text-fg-muted border-transparent hover:bg-white/[0.05] hover:text-fg",
  danger:
    "bg-danger/10 text-danger border-danger/25 hover:bg-danger/15 hover:border-danger/40",
  success:
    "bg-ok/10 text-ok border-ok/25 hover:bg-ok/15 hover:border-ok/40",
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
        "inline-flex select-none items-center rounded-[10px] border font-medium",
        "transition-[background-color,border-color,transform,filter,box-shadow] duration-150 ease-out",
        "active:scale-[0.975] disabled:pointer-events-none disabled:opacity-40",
        variants[variant],
        sizes[size],
        className,
      )}
      {...props}
    />
  ),
);
Button.displayName = "Button";
