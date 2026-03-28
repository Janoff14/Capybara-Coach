import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl font-semibold transition-all duration-200 outline-none disabled:pointer-events-none disabled:opacity-50 active:scale-[0.98]",
  {
    variants: {
      variant: {
        default:
          "ink-gradient text-white shadow-[var(--shadow-button)] hover:-translate-y-0.5 hover:brightness-[1.02]",
        secondary:
          "border border-[var(--border-soft)] bg-[rgba(255,255,255,0.92)] text-[var(--primary)] shadow-[0_1px_2px_rgba(0,0,0,0.04)] hover:bg-[var(--panel-soft)] hover:text-[var(--primary-strong)]",
        ghost:
          "text-[var(--foreground-soft)] hover:bg-[rgba(75,102,72,0.06)] hover:text-[var(--primary)]",
        destructive:
          "bg-[var(--danger)] text-white shadow-[0_10px_24px_rgba(167,59,33,0.18)] hover:-translate-y-0.5 hover:brightness-105",
      },
      size: {
        default: "h-11 px-4 py-2 text-sm",
        sm: "h-9 px-3 text-sm",
        lg: "h-14 px-6 text-base",
        icon: "h-11 w-11 rounded-full",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
  }) {
  const Comp = asChild ? Slot : "button";

  return (
    <Comp
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}

export { Button, buttonVariants };
