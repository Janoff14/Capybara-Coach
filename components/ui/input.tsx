import * as React from "react";

import { cn } from "@/lib/utils";

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      className={cn(
        "flex h-14 w-full rounded-xl border border-transparent bg-[var(--panel-muted)] px-4 py-3 text-sm text-[var(--foreground)] outline-none placeholder:text-[rgba(121,124,117,0.72)] transition-all file:mr-4 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-[var(--foreground-soft)] focus:border-[rgba(75,102,72,0.18)] focus:bg-white focus:ring-1 focus:ring-[rgba(75,102,72,0.18)]",
        className,
      )}
      {...props}
    />
  );
}

export { Input };
