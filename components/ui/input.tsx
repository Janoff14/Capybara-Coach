import * as React from "react";

import { cn } from "@/lib/utils";

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      className={cn(
        "flex h-11 w-full rounded-xl border border-white/12 bg-white/8 px-4 py-2 text-sm text-white outline-none placeholder:text-slate-400 focus:border-cyan-300/70 focus:bg-white/10",
        className,
      )}
      {...props}
    />
  );
}

export { Input };
