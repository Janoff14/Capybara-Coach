import type { StudySessionRead } from "@/lib/types";

const RECORDING_STATUSES = new Set([
  "reading_complete",
  "audio_uploaded",
  "transcribed",
]);

export function sessionDestination(session: StudySessionRead) {
  if (
    session.transcript_provider === "typed-capture-v1" ||
    session.status === "capturing_notes"
  ) {
    return `/study/${session.id}/capture`;
  }

  if (session.status === "assessed" || session.status === "notes_ready") {
    return `/study/${session.id}/assessment`;
  }

  if (session.source_note_id || RECORDING_STATUSES.has(session.status)) {
    return `/study/${session.id}/record`;
  }

  return `/study/${session.id}/read`;
}
