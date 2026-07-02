import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const STATUS_LABELS: Record<string, string> = {
  created: "Created",
  reading_complete: "Reading complete",
  capturing_notes: "Capturing notes",
  audio_uploaded: "Audio uploaded",
  transcribed: "Transcribed",
  assessed: "Assessed",
  notes_ready: "Notes ready",
};

export function SessionStatusBadge({ status }: { status: string }) {
  return (
    <Badge
      className={cn(
        status === "notes_ready" && "bg-[rgba(133,165,121,0.18)] text-[var(--primary)]",
        status === "assessed" && "bg-[rgba(245,212,140,0.3)] text-[var(--warning)]",
        status === "audio_uploaded" && "bg-[rgba(235,231,231,0.8)] text-[var(--muted-foreground)]",
      )}
    >
      {STATUS_LABELS[status] ?? status.replaceAll("_", " ")}
    </Badge>
  );
}
