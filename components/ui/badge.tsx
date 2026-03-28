import * as React from "react";

import { cn } from "@/lib/utils";

function Badge({ className, ...props }: React.ComponentProps<"span">) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border border-[rgba(194,200,190,0.35)] bg-[rgba(133,165,121,0.12)] px-3 py-1 text-xs font-semibold uppercase tracking-[0.08em] text-[var(--primary)]",
        className,
      )}
      {...props}
    />
  );
}

export { Badge };
