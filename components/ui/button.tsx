import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-semibold transition-all outline-none disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default:
          "bg-gradient-to-r from-[var(--primary)] to-[var(--primary-soft)] text-white shadow-[var(--shadow-button)] hover:brightness-[1.03]",
        secondary:
          "border border-[var(--border-soft)] bg-white text-[var(--muted-foreground)] shadow-[0_1px_2px_rgba(0,0,0,0.04)] hover:bg-[var(--panel-soft)] hover:text-[var(--foreground)]",
        ghost:
          "text-[var(--muted-foreground)] hover:bg-[rgba(73,102,64,0.06)] hover:text-[var(--primary)]",
        destructive:
          "bg-[var(--danger)] text-white shadow-[0_10px_15px_rgba(186,26,26,0.14)] hover:brightness-110",
      },
      size: {
        default: "h-11 px-4 py-2",
        sm: "h-9 px-3",
        lg: "h-14 px-6 text-base",
        icon: "h-11 w-11",
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
