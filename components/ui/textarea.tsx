import * as React from "react";

import { cn } from "@/lib/utils";

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      className={cn(
        "flex min-h-32 w-full rounded-xl border border-white/12 bg-white/8 px-4 py-3 text-sm text-white outline-none placeholder:text-slate-400 focus:border-cyan-300/70 focus:bg-white/10",
        className,
      )}
      {...props}
    />
  );
}

export { Textarea };
