import * as React from "react";

import { cn } from "@/lib/utils";

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      className={cn(
        "flex h-14 w-full rounded-xl border border-transparent bg-[var(--panel-muted)] px-4 py-3 text-sm text-[var(--foreground)] outline-none placeholder:text-[var(--muted-foreground)] transition-all file:mr-4 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-[var(--foreground-soft)] focus:border-[var(--border-strong)] focus:bg-[var(--panel)] focus:ring-1 focus:ring-[var(--border-strong)]",
        className,
      )}
      {...props}
    />
  );
}

export { Input };
