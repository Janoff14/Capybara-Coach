import * as React from "react";
import * as LabelPrimitive from "@radix-ui/react-label";

import { cn } from "@/lib/utils";

function Label({
  className,
  ...props
}: React.ComponentProps<typeof LabelPrimitive.Root>) {
  return (
    <LabelPrimitive.Root
      className={cn(
        "text-xs font-semibold uppercase tracking-[0.12em] text-[var(--muted-foreground)]",
        className,
      )}
      {...props}
    />
  );
}

export { Label };
