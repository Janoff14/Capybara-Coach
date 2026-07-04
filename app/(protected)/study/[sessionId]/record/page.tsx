"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FileLock2, Mic, PauseCircle, PlayCircle, Sparkles, Square, Upload } from "lucide-react";
import { toast } from "sonner";

import { CapybaraCoach } from "@/components/app/capybara-coach";
import { EmptyState } from "@/components/app/empty-state";
import { PageHeader } from "@/components/app/page-header";
import { RecallSessionPanel } from "@/components/app/recall-session-panel";
import { SessionStatusBadge } from "@/components/app/session-status-badge";
import { VoiceWaveform } from "@/components/app/voice-waveform";
import { useAuth } from "@/components/providers/auth-provider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { api, ApiError } from "@/lib/api";
import { buildReaderGuide } from "@/lib/document-reader";
import {
  buildFallbackRecallHint,
  buildRecallChecklist,
  buildRecallPrompts,
} from "@/lib/recall";
import type { RecallHintRead } from "@/lib/types";
import { useMediaRecorder } from "@/hooks/use-media-recorder";
import { formatElapsed } from "@/lib/utils";

const HINT_PAUSE_THRESHOLD_MS = 5000;

function getFileExtension(mimeType: string | null) {
  if (!mimeType) {
    return "webm";
  }

  if (mimeType.includes("mp4")) {
    return "m4a";
  }

  if (mimeType.includes("wav")) {
    return "wav";
  }

  return "webm";
}

export default function StudyRecordPage() {
  const params = useParams<{ sessionId: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const { token } = useAuth();
  const recorder = useMediaRecorder();
  const autoStartRequested = searchParams.get("autostart") === "1";
  const autoStartAttemptedRef = useRef(false);
  const [enteredFromReader] = useState(autoStartRequested);
  const [activeHint, setActiveHint] = useState<RecallHintRead | null>(null);
  const [recallTranscript, setRecallTranscript] = useState("");
  const currentPauseHintedRef = useRef(false);
  const lastHintAtRef = useRef(0);
  const hintCountRef = useRef(0);
  const lastHintMessageRef = useRef("");

  const sessionQuery = useQuery({
    queryKey: ["sessions", params.sessionId],
    enabled: Boolean(token && params.sessionId),
    queryFn: () => api.getSession(params.sessionId, token!),
  });

  const documentQuery = useQuery({
    queryKey: ["documents", sessionQuery.data?.document_id],
    enabled: Boolean(token && sessionQuery.data?.document_id),
    queryFn: () => api.getDocument(sessionQuery.data!.document_id, token!),
  });

  const sourceNoteQuery = useQuery({
    queryKey: ["notes", sessionQuery.data?.source_note_id],
    enabled: Boolean(token && sessionQuery.data?.source_note_id),
    queryFn: () => api.getNote(sessionQuery.data!.source_note_id!, token!),
  });

  const submitMutation = useMutation({
    mutationFn: async () => {
      if (!token) {
        throw new Error("You need to be logged in to upload audio.");
      }

      if (!recorder.audioBlob) {
        throw new Error("Record audio before submitting it.");
      }

      const extension = getFileExtension(recorder.mimeType);
      const file = new File(
        [recorder.audioBlob],
        `session-${params.sessionId}.${extension}`,
        { type: recorder.mimeType || "audio/webm" },
      );

      await api.uploadSessionAudio(token, params.sessionId, file);
      await api.transcribeSession(token, params.sessionId);
      return api.assessSession(token, params.sessionId);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["sessions"] });
      await queryClient.invalidateQueries({ queryKey: ["sessions", params.sessionId] });
      toast.success("Recording uploaded, transcribed, and assessed.");
      router.push(`/study/${params.sessionId}/assessment`);
    },
    onError: (error) => {
      const message =
        error instanceof ApiError || error instanceof Error
          ? error.message
          : "Audio submission failed.";
      toast.error(message);
    },
  });

  const session = sessionQuery.data;
  const document = documentQuery.data;
  const sourceNote = sourceNoteQuery.data;
  const isNoteRecall = Boolean(session?.source_note_id);
  const recallSourceTitle = sourceNote?.title ?? document?.title ?? "this material";
  const recallSourceText = sourceNote
    ? [sourceNote.summary, sourceNote.content].filter(Boolean).join("\n\n")
    : document?.extracted_text ?? "";
  const readerGuide = useMemo(
    () => buildReaderGuide(recallSourceText, isNoteRecall ? null : document?.reader_json ?? null),
    [document?.reader_json, isNoteRecall, recallSourceText],
  );
  const recallPrompts = useMemo(
    () => buildRecallPrompts(recallSourceTitle, readerGuide),
    [readerGuide, recallSourceTitle],
  );
  const recallChecklist = useMemo(
    () => buildRecallChecklist(readerGuide),
    [readerGuide],
  );

  const canOpenAssessment =
    session?.status === "assessed" || session?.status === "notes_ready";
  const shouldAutoStart =
    autoStartRequested ||
    (session?.status === "reading_complete" &&
      !session.audio_storage_path &&
      !recorder.audioBlob);

  const recallHintMutation = useMutation({
    mutationFn: async () => {
      if (!token) {
        throw new Error("You need to be logged in to request recall hints.");
      }

      const hintBlob = recorder.getRecentAudioBlob(14000);
      if (!hintBlob || hintBlob.size < 1024) {
        throw new Error("Not enough recent speech to generate a hint.");
      }

      const hintFile = new File([hintBlob], `recall-hint-${params.sessionId}.webm`, {
        type: recorder.mimeType || "audio/webm",
      });

      return api.getRecallHint(token, params.sessionId, hintFile, recallTranscript);
    },
    onSuccess: (hint: RecallHintRead) => {
      const nextMessage =
        hint.message === lastHintMessageRef.current
          ? "Push one step deeper. What is still missing from the explanation?"
          : hint.message;

      lastHintMessageRef.current = nextMessage;
      setRecallTranscript(hint.transcript_so_far);
      setActiveHint({
        ...hint,
        message: nextMessage,
      });
      lastHintAtRef.current = Date.now();
      currentPauseHintedRef.current = true;
      hintCountRef.current += 1;
    },
    onError: () => {
      const fallbackHint = buildFallbackRecallHint(
        recallSourceTitle,
        readerGuide,
        recallTranscript,
        hintCountRef.current,
      );
      lastHintMessageRef.current = fallbackHint.message;
      setActiveHint(fallbackHint);
      lastHintAtRef.current = Date.now();
      currentPauseHintedRef.current = true;
      hintCountRef.current += 1;
    },
  });

  const resetRecallState = useCallback(() => {
    setRecallTranscript("");
    setActiveHint(null);
    currentPauseHintedRef.current = false;
    hintCountRef.current = 0;
    lastHintAtRef.current = 0;
    lastHintMessageRef.current = "";
  }, []);

  const handleStartRecording = useCallback(() => {
    resetRecallState();
    void recorder.startRecording();
  }, [recorder, resetRecallState]);

  const handleResetRecall = useCallback(() => {
    resetRecallState();
    recorder.reset();
  }, [recorder, resetRecallState]);

  useEffect(() => {
    if (!shouldAutoStart || autoStartAttemptedRef.current) {
      return;
    }

    if (!recorder.isSupported || recorder.isRecording || recorder.audioBlob) {
      return;
    }

    autoStartAttemptedRef.current = true;
    void recorder.startRecording();
    router.replace(`/study/${params.sessionId}/record`);
  }, [
    params.sessionId,
    recorder,
    router,
    shouldAutoStart,
  ]);

  useEffect(() => {
    if (!recorder.isRecording && !recorder.audioBlob) {
      currentPauseHintedRef.current = false;
      hintCountRef.current = 0;
      lastHintAtRef.current = 0;
      lastHintMessageRef.current = "";
      return;
    }

    if (!recorder.isRecording) {
      return;
    }

    if (recorder.hasSpoken && recorder.silenceDurationMs < 1200) {
      currentPauseHintedRef.current = false;
    }

    if (!recorder.hasSpoken || recorder.silenceDurationMs < HINT_PAUSE_THRESHOLD_MS) {
      return;
    }

    if (recallHintMutation.isPending || currentPauseHintedRef.current) {
      return;
    }

    if (hintCountRef.current >= 3) {
      return;
    }

    if (Date.now() - lastHintAtRef.current < 9000) {
      return;
    }

    recallHintMutation.mutate();
  }, [
    recallHintMutation,
    recorder.audioBlob,
    recorder.hasSpoken,
    recorder.isRecording,
    recorder.silenceDurationMs,
    recallTranscript,
  ]);

  const coach = useMemo(() => {
    if (!recorder.isRecording) {
      if (recorder.audioBlob) {
        return {
          state: "encouraging" as const,
          promptType: null,
          message: "Nice. Listen once if you want, then submit this take for feedback.",
        };
      }

      return {
        state: "idle" as const,
        promptType: null,
        message: `When you are ready, explain ${isNoteRecall ? "the note" : "the document"} from memory. I will stay quiet unless you stall.`,
      };
    }

    if (recallHintMutation.isPending) {
      return {
        state: "thinking" as const,
        promptType: null,
        message: "Thinking about the gap in your explanation...",
      };
    }

    if (recorder.hasSpoken && recorder.silenceDurationMs >= HINT_PAUSE_THRESHOLD_MS && !activeHint) {
      return {
        state: "thinking" as const,
        promptType: "recall" as const,
        message: "Pause noticed. What comes immediately after that main idea?",
      };
    }

    if (activeHint && recorder.silenceDurationMs >= 1200) {
      return {
        state: activeHint.state,
        promptType: activeHint.prompt_type,
        message: activeHint.message,
      };
    }

    if (!recorder.hasSpoken) {
      return {
        state: "listening" as const,
        promptType: "recall" as const,
        message: "Start with one sentence that captures the main idea.",
      };
    }

    return {
      state: "listening" as const,
      promptType: null,
      message:
        recorder.elapsedSeconds > 14
          ? "Listening. Keep building the explanation in your own order."
          : "Listening. Start with the main idea, then build outward.",
    };
  }, [
    activeHint,
    recallHintMutation.isPending,
    recorder.audioBlob,
    recorder.elapsedSeconds,
    recorder.hasSpoken,
    recorder.isRecording,
    recorder.silenceDurationMs,
    isNoteRecall,
  ]);

  const recorderStateLabel = useMemo(() => {
    if (recorder.isRecording) {
      return "Live recall";
    }

    if (recorder.audioBlob) {
      return "Take captured";
    }

    if (enteredFromReader) {
      return "Priming recall";
    }

    return "Ready";
  }, [enteredFromReader, recorder.audioBlob, recorder.isRecording]);

  const voiceStatusLabel = useMemo(() => {
    if (!recorder.isRecording) {
      return recorder.audioBlob ? "Take recorded" : "Waiting for voice";
    }

    return recorder.hasSpoken ? "Voice detected" : "Waiting for voice";
  }, [recorder.audioBlob, recorder.hasSpoken, recorder.isRecording]);

  const quickMicLabel = recorder.isRecording ? "Tap to stop" : "Tap to start";
  const recallWordCount = useMemo(
    () => recallTranscript.trim().split(/\s+/).filter(Boolean).length,
    [recallTranscript],
  );

  return (
    <div className="catalog-study-page catalog-recall-page space-y-8">
      <PageHeader
        eyebrow="Recall mode"
        title={sourceNote?.title ?? document?.title ?? "Recall from memory"}
        description={
          isNoteRecall
            ? "The note is intentionally out of view. Retell it from memory and the app will assess only your recall—no duplicate note or flashcards will be generated."
            : "The source is intentionally out of view now. Speak the material back from memory, then let the app upload, transcribe, and assess the explanation for you."
        }
        actions={
          <>
            {session ? <SessionStatusBadge status={session.status} /> : null}
            {canOpenAssessment ? (
              <Button variant="secondary" onClick={() => router.push(`/study/${params.sessionId}/assessment`)}>
                Open feedback
              </Button>
            ) : null}
          </>
        }
      />

      {!recorder.isSupported ? (
        <EmptyState
          title="Recording is not supported in this browser"
          description="The MVP targets desktop Chromium. Open the app in Chrome or Edge to use the MediaRecorder flow."
        />
      ) : (
        <div className="surface-grid xl:grid-cols-[1.15fr_0.85fr] xl:grid">
          <Card>
            <CardHeader>
              <CardTitle>Recall recorder</CardTitle>
              <CardDescription>
                Start with the big idea, then reconstruct the important parts in your own sequence and language.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
                <div className="rounded-[28px] border border-[rgba(73,102,64,0.12)] bg-[linear-gradient(180deg,rgba(73,102,64,0.08),rgba(255,255,255,0.88))] p-5 shadow-[0_20px_40px_rgba(28,27,27,0.08)]">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--primary)]">
                        Live microphone
                      </p>
                      <p className="mt-2 font-display text-3xl font-bold tracking-[-0.05em] text-[var(--foreground)]">
                        {recorder.isRecording ? "Listening now" : "Ready for recall"}
                      </p>
                      <p className="mt-2 text-sm leading-7 text-[var(--muted-foreground)]">
                        Speak naturally. The coach only steps in when a pause suggests you are stuck.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        if (recorder.isRecording) {
                          recorder.stopRecording();
                          return;
                        }

                        handleStartRecording();
                      }}
                      disabled={submitMutation.isPending}
                      className="group flex flex-col items-center gap-2 rounded-[28px] border border-[rgba(73,102,64,0.12)] bg-white px-4 py-3 text-center shadow-[0_16px_34px_rgba(28,27,27,0.08)] transition hover:border-[rgba(73,102,64,0.22)] hover:shadow-[0_20px_40px_rgba(28,27,27,0.12)] disabled:opacity-50"
                    >
                      <div className="relative flex h-16 w-16 items-center justify-center rounded-full border border-[rgba(73,102,64,0.18)] bg-[rgba(255,255,255,0.92)]">
                        {recorder.isRecording ? (
                          <span className="absolute inset-0 rounded-full border border-[rgba(73,102,64,0.22)] animate-ping" />
                        ) : null}
                        <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[linear-gradient(180deg,var(--primary-soft),var(--primary))] text-white shadow-[0_12px_24px_rgba(73,102,64,0.22)]">
                          <Mic className="size-5" />
                        </div>
                      </div>
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--muted-foreground)]">
                          Quick mic
                        </p>
                        <p className="mt-1 text-xs font-medium text-[var(--foreground)]">{quickMicLabel}</p>
                      </div>
                    </button>
                  </div>

                  <div className="mt-5">
                    <VoiceWaveform
                      audioLevel={recorder.audioLevel}
                      hasSpoken={recorder.hasSpoken}
                      isRecording={recorder.isRecording}
                    />
                  </div>

                  <div className="mt-4 flex flex-wrap items-center gap-2 text-xs uppercase tracking-[0.16em] text-[var(--muted-foreground)]">
                    <span className="rounded-full border border-[var(--border-soft)] bg-white px-3 py-1.5">
                      {recorder.isRecording ? "Mic hot" : "Mic idle"}
                    </span>
                    <span className="rounded-full border border-[var(--border-soft)] bg-white px-3 py-1.5">
                      {voiceStatusLabel}
                    </span>
                    <span className="rounded-full border border-[var(--border-soft)] bg-white px-3 py-1.5">
                      {coach.state === "thinking" ? "Coach thinking" : "Coach ready"}
                    </span>
                    <span className="rounded-full border border-[var(--border-soft)] bg-white px-3 py-1.5">
                      {activeHint?.source === "ai"
                        ? "Live analysis"
                        : activeHint?.source === "fallback"
                          ? "Guide fallback"
                          : `${recallWordCount} words tracked`}
                    </span>
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-2">
                  <div className="rounded-2xl border border-[var(--border-soft)] bg-[var(--panel-soft)] p-4">
                    <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted-foreground)]">
                      Mode
                    </p>
                    <div className="mt-2 flex items-center gap-2 text-lg font-semibold text-[var(--foreground)]">
                      <FileLock2 className="size-4 text-[var(--primary)]" />
                      Source hidden
                    </div>
                  </div>
                  <div className="rounded-2xl border border-[var(--border-soft)] bg-[var(--panel-soft)] p-4">
                    <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted-foreground)]">
                      State
                    </p>
                    <p className="mt-2 text-2xl font-semibold text-[var(--foreground)]">
                      {recorderStateLabel}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-[var(--border-soft)] bg-[var(--panel-soft)] p-4">
                    <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted-foreground)]">
                      Elapsed
                    </p>
                    <p className="mt-2 text-2xl font-semibold text-[var(--foreground)]">
                      {formatElapsed(recorder.elapsedSeconds)}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-[var(--border-soft)] bg-[var(--panel-soft)] p-4">
                    <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted-foreground)]">
                      Silence
                    </p>
                    <p className="mt-2 text-2xl font-semibold text-[var(--foreground)]">
                      {formatElapsed(Math.floor(recorder.silenceDurationMs / 1000))}
                    </p>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-[rgba(73,102,64,0.12)] bg-[linear-gradient(180deg,rgba(73,102,64,0.08),rgba(255,255,255,0.82))] px-4 py-4 text-sm leading-7 text-[var(--muted-foreground)]">
                <div className="flex items-center gap-2 text-[var(--foreground)]">
                  <Sparkles className="size-4 text-[var(--primary)]" />
                  <p className="font-semibold">Recall cue</p>
                </div>
                <p className="mt-2">
                  Treat this like a spoken retrieval drill. You are not trying to sound perfect on the first sentence, only to recover the material from memory and explain it clearly.
                </p>
                <p className="mt-3 text-sm leading-7 text-[var(--foreground)]">
                  {coach.message}
                </p>
                {recallTranscript ? (
                  <p className="mt-3 text-xs uppercase tracking-[0.14em] text-[var(--muted-foreground)]">
                    Tracking {recallWordCount} words of recall so far.
                  </p>
                ) : null}
                {activeHint?.missing_concepts.length ? (
                  <div className="mt-4 flex flex-wrap gap-2">
                    {activeHint.missing_concepts.map((item) => (
                      <span
                        key={item}
                        className="rounded-full border border-[rgba(73,102,64,0.16)] bg-white px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--primary)]"
                      >
                        {item}
                      </span>
                    ))}
                  </div>
                ) : null}
              </div>

              {recorder.error ? (
                <div className="rounded-2xl border border-rose-400/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
                  {recorder.error}
                </div>
              ) : null}

              <div className="flex flex-wrap items-center gap-3">
                <Button
                  size="lg"
                  className="min-w-[12rem]"
                  onClick={handleStartRecording}
                  disabled={recorder.isRecording || submitMutation.isPending}
                >
                  <Mic className="size-4" />
                  {enteredFromReader && !recorder.audioBlob ? "Start recall manually" : "Start recall"}
                </Button>
                <Button
                  size="lg"
                  variant="secondary"
                  className="min-w-[9rem]"
                  onClick={recorder.stopRecording}
                  disabled={!recorder.isRecording}
                >
                  <Square className="size-4" />
                  Stop
                </Button>
                <Button
                  size="lg"
                  variant="ghost"
                  className="min-w-[9rem]"
                  onClick={handleResetRecall}
                  disabled={recorder.isRecording || !recorder.audioBlob}
                >
                  <PauseCircle className="size-4" />
                  Reset
                </Button>
              </div>

              {recorder.audioUrl ? (
                <div className="rounded-2xl border border-[var(--border-soft)] bg-[var(--panel-soft)] p-4">
                  <div className="mb-3 flex items-center gap-2 text-sm text-[var(--foreground)]">
                    <PlayCircle className="size-4 text-[var(--primary)]" />
                    Preview before upload
                  </div>
                  <audio controls className="w-full" src={recorder.audioUrl}>
                    <track kind="captions" />
                  </audio>
                </div>
              ) : null}

              <Button
                className="w-full"
                size="lg"
                onClick={() => submitMutation.mutate()}
                disabled={!recorder.audioBlob || recorder.isRecording || submitMutation.isPending}
              >
                <Upload className="size-4" />
                {submitMutation.isPending
                  ? "Uploading, transcribing, and assessing..."
                  : "Submit recall"}
              </Button>
            </CardContent>
          </Card>

          <RecallSessionPanel
            checklist={recallChecklist}
            documentTitle={sourceNote?.title ?? document?.title ?? "Current source"}
            pageCount={isNoteRecall ? null : document?.page_count ?? null}
            prompts={recallPrompts}
          />
        </div>
      )}

      <CapybaraCoach
        message={coach.message}
        promptType={coach.promptType}
        state={coach.state}
      />
    </div>
  );
}
