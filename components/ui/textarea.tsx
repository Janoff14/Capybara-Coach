import * as React from "react";

import { cn } from "@/lib/utils";

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      className={cn(
        "flex min-h-32 w-full rounded-xl border border-[var(--border-soft)] bg-[var(--panel-soft)] px-4 py-3 text-sm text-[var(--foreground)] outline-none placeholder:text-[rgba(114,121,112,0.7)] focus:border-[var(--primary-soft)] focus:bg-white",
        className,
      )}
      {...props}
    />
  );
}

export { Textarea };
