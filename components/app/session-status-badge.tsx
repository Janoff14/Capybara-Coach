import { Badge } from "@/components/ui/badge";

const STATUS_LABELS: Record<string, string> = {
  created: "Created",
  reading_complete: "Reading complete",
  audio_uploaded: "Audio uploaded",
  transcribed: "Transcribed",
  assessed: "Assessed",
  notes_ready: "Notes ready",
};

export function SessionStatusBadge({ status }: { status: string }) {
  return <Badge>{STATUS_LABELS[status] ?? status.replaceAll("_", " ")}</Badge>;
}
