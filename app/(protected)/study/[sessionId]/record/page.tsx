"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FileLock2, Mic, PauseCircle, PlayCircle, Sparkles, Square, Upload } from "lucide-react";
import { toast } from "sonner";

import { CapybaraCoach } from "@/components/app/capybara-coach";
import { EmptyState } from "@/components/app/empty-state";
import { PageHeader } from "@/components/app/page-header";
import { RecallSessionPanel } from "@/components/app/recall-session-panel";
import { SessionStatusBadge } from "@/components/app/session-status-badge";
import { useAuth } from "@/components/providers/auth-provider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { api, ApiError } from "@/lib/api";
import { buildReaderGuide } from "@/lib/document-reader";
import { buildRecallChecklist, buildRecallPrompts } from "@/lib/recall";
import type { RecallHintRead } from "@/lib/types";
import { useMediaRecorder } from "@/hooks/use-media-recorder";
import { formatElapsed } from "@/lib/utils";

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
  const readerGuide = useMemo(
    () => buildReaderGuide(document?.extracted_text ?? "", document?.reader_json ?? null),
    [document?.extracted_text, document?.reader_json],
  );
  const recallPrompts = useMemo(
    () => buildRecallPrompts(document?.title ?? "this document", readerGuide),
    [document?.title, readerGuide],
  );
  const recallChecklist = useMemo(
    () => buildRecallChecklist(readerGuide),
    [readerGuide],
  );

  const canOpenAssessment =
    session?.status === "assessed" || session?.status === "notes_ready";

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

      return api.getRecallHint(token, params.sessionId, hintFile);
    },
    onSuccess: (hint: RecallHintRead) => {
      const nextMessage =
        hint.message === lastHintMessageRef.current
          ? "Push one step deeper. What is still missing from the explanation?"
          : hint.message;

      lastHintMessageRef.current = nextMessage;
      setActiveHint({
        ...hint,
        message: nextMessage,
      });
      lastHintAtRef.current = Date.now();
      currentPauseHintedRef.current = true;
      hintCountRef.current += 1;
    },
    onError: () => {
      setActiveHint(null);
      lastHintAtRef.current = Date.now();
      currentPauseHintedRef.current = true;
    },
  });

  useEffect(() => {
    if (!autoStartRequested || autoStartAttemptedRef.current) {
      return;
    }

    if (!recorder.isSupported || recorder.isRecording || recorder.audioBlob) {
      return;
    }

    autoStartAttemptedRef.current = true;
    void recorder.startRecording();
    router.replace(`/study/${params.sessionId}/record`);
  }, [
    autoStartRequested,
    params.sessionId,
    recorder,
    router,
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

    if (!recorder.hasSpoken || recorder.silenceDurationMs < 4200) {
      return;
    }

    if (recallHintMutation.isPending || currentPauseHintedRef.current) {
      return;
    }

    if (hintCountRef.current >= 3) {
      return;
    }

    if (Date.now() - lastHintAtRef.current < 12000) {
      return;
    }

    recallHintMutation.mutate();
  }, [
    recallHintMutation,
    recorder.audioBlob,
    recorder.hasSpoken,
    recorder.isRecording,
    recorder.silenceDurationMs,
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
        message: "When you are ready, explain the document from memory. I will stay quiet unless you stall.",
      };
    }

    if (recallHintMutation.isPending) {
      return {
        state: "thinking" as const,
        promptType: null,
        message: "Thinking about the gap in your explanation...",
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

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Recall mode"
        title={document?.title ?? "Recall from memory"}
        description="The source is intentionally out of view now. Speak the material back from memory, then let the app upload, transcribe, and assess the explanation for you."
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
              <div className="grid gap-4 md:grid-cols-3">
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

              <div className="rounded-2xl border border-[rgba(73,102,64,0.12)] bg-[linear-gradient(180deg,rgba(73,102,64,0.08),rgba(255,255,255,0.82))] px-4 py-4 text-sm leading-7 text-[var(--muted-foreground)]">
                <div className="flex items-center gap-2 text-[var(--foreground)]">
                  <Sparkles className="size-4 text-[var(--primary)]" />
                  <p className="font-semibold">Recall cue</p>
                </div>
                <p className="mt-2">
                  Treat this like a spoken retrieval drill. You are not trying to sound perfect on the first sentence, only to recover the material from memory and explain it clearly.
                </p>
                <div className="mt-4 h-2 overflow-hidden rounded-full bg-[rgba(73,102,64,0.12)]">
                  <div
                    className="h-full rounded-full bg-[linear-gradient(90deg,var(--primary),var(--primary-soft))] transition-all"
                    style={{ width: `${Math.min(100, Math.max(6, recorder.audioLevel * 1200))}%` }}
                  />
                </div>
              </div>

              {recorder.error ? (
                <div className="rounded-2xl border border-rose-400/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
                  {recorder.error}
                </div>
              ) : null}

              <div className="flex flex-wrap items-center gap-3">
                <Button
                  size="lg"
                  onClick={() => void recorder.startRecording()}
                  disabled={recorder.isRecording || submitMutation.isPending}
                >
                  <Mic className="size-4" />
                  {enteredFromReader && !recorder.audioBlob ? "Start recall manually" : "Start recall"}
                </Button>
                <Button
                  size="lg"
                  variant="secondary"
                  onClick={recorder.stopRecording}
                  disabled={!recorder.isRecording}
                >
                  <Square className="size-4" />
                  Stop
                </Button>
                <Button
                  size="lg"
                  variant="ghost"
                  onClick={recorder.reset}
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
            documentTitle={document?.title ?? "Current document"}
            pageCount={document?.page_count ?? null}
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
