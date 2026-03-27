"use client";

import { useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Mic, PauseCircle, PlayCircle, Square, Upload } from "lucide-react";
import { toast } from "sonner";

import { EmptyState } from "@/components/app/empty-state";
import { PageHeader } from "@/components/app/page-header";
import { SessionStatusBadge } from "@/components/app/session-status-badge";
import { useAuth } from "@/components/providers/auth-provider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { api, ApiError } from "@/lib/api";
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
  const queryClient = useQueryClient();
  const { token } = useAuth();
  const recorder = useMediaRecorder();

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

  const canOpenAssessment =
    session?.status === "assessed" || session?.status === "notes_ready";

  const recorderStateLabel = useMemo(() => {
    if (recorder.isRecording) {
      return "Recording";
    }

    if (recorder.audioBlob) {
      return "Ready to submit";
    }

    return "Idle";
  }, [recorder.audioBlob, recorder.isRecording]);

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Recording"
        title={document?.title ?? "Record your explanation"}
        description="Explain the source back in your own words. Once you submit the recording, the app will upload it, transcribe it, and run assessment before routing you to the results."
        actions={
          <>
            {session ? <SessionStatusBadge status={session.status} /> : null}
            {canOpenAssessment ? (
              <Button variant="secondary" onClick={() => router.push(`/study/${params.sessionId}/assessment`)}>
                Open assessment
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
              <CardTitle>Recorder</CardTitle>
              <CardDescription>
                Keep the explanation concise and cover the key points you just read.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="rounded-2xl border border-white/10 bg-white/6 p-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
                    State
                  </p>
                  <p className="mt-2 text-2xl font-semibold text-white">
                    {recorderStateLabel}
                  </p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/6 p-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
                    Elapsed
                  </p>
                  <p className="mt-2 text-2xl font-semibold text-white">
                    {formatElapsed(recorder.elapsedSeconds)}
                  </p>
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
                  Start recording
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
                <div className="rounded-2xl border border-white/10 bg-white/6 p-4">
                  <div className="mb-3 flex items-center gap-2 text-sm text-slate-200">
                    <PlayCircle className="size-4 text-cyan-300" />
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
                  : "Submit recording"}
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Session guidance</CardTitle>
              <CardDescription>
                Use the recording to prove recall, not to reread the document aloud.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="rounded-2xl border border-white/10 bg-white/6 p-4 text-sm leading-7 text-slate-200">
                <p className="font-medium text-white">Aim for this structure</p>
                <ol className="mt-3 space-y-2">
                  <li>1. State the main idea clearly.</li>
                  <li>2. Cover the key supporting points from memory.</li>
                  <li>3. Give one example if it helps.</li>
                  <li>4. Keep it concise and confident.</li>
                </ol>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/6 p-4 text-sm text-slate-300">
                <p className="font-medium text-white">Current document</p>
                <p className="mt-2">{document?.title ?? "Loading document..."}</p>
                <p className="mt-1 text-xs text-slate-400">
                  {document?.page_count ?? "--"} pages
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
