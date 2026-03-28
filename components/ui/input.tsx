import * as React from "react";

import { cn } from "@/lib/utils";

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      className={cn(
        "flex h-11 w-full rounded-xl border border-[var(--border-soft)] bg-[var(--panel-soft)] px-4 py-2 text-sm text-[var(--foreground)] outline-none placeholder:text-[rgba(114,121,112,0.7)] transition-colors file:mr-4 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-[var(--muted-foreground)] focus:border-[var(--primary-soft)] focus:bg-white",
        className,
      )}
      {...props}
    />
  );
}

export { Input };
