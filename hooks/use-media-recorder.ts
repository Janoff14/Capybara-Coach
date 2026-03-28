"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const PREFERRED_MIME_TYPES = [
  "audio/webm;codecs=opus",
  "audio/webm",
  "audio/mp4",
];

function getSupportedMimeType() {
  if (typeof window === "undefined" || typeof MediaRecorder === "undefined") {
    return null;
  }

  return (
    PREFERRED_MIME_TYPES.find((value) => MediaRecorder.isTypeSupported(value)) ??
    null
  );
}

export function useMediaRecorder() {
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timedChunksRef = useRef<Array<{ blob: Blob; createdAt: number }>>([]);
  const startedAtRef = useRef<number | null>(null);
  const objectUrlRef = useRef<string | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const monitorFrameRef = useRef<number | null>(null);
  const lastSpeechAtRef = useRef<number | null>(null);
  const hasSpokenRef = useRef(false);

  const [isRecording, setIsRecording] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [mimeType, setMimeType] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [audioLevel, setAudioLevel] = useState(0);
  const [silenceDurationMs, setSilenceDurationMs] = useState(0);
  const [hasSpoken, setHasSpoken] = useState(false);

  const isSupported =
    typeof window !== "undefined" &&
    typeof navigator !== "undefined" &&
    Boolean(navigator.mediaDevices?.getUserMedia) &&
    typeof MediaRecorder !== "undefined";

  const clearPreview = useCallback(() => {
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }

    setAudioUrl(null);
    setAudioBlob(null);
  }, []);

  const stopMonitoring = useCallback(() => {
    if (monitorFrameRef.current) {
      window.cancelAnimationFrame(monitorFrameRef.current);
      monitorFrameRef.current = null;
    }

    analyserRef.current?.disconnect();
    analyserRef.current = null;

    if (audioContextRef.current) {
      void audioContextRef.current.close();
      audioContextRef.current = null;
    }

    setAudioLevel(0);
    setSilenceDurationMs(0);
  }, []);

  const stopTracks = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }, []);

  const reset = useCallback(() => {
    clearPreview();
    setMimeType(null);
    setElapsedSeconds(0);
    setError(null);
    setAudioLevel(0);
    setSilenceDurationMs(0);
    setHasSpoken(false);
    hasSpokenRef.current = false;
    lastSpeechAtRef.current = null;
    timedChunksRef.current = [];
  }, [clearPreview]);

  const stopRecording = useCallback(() => {
    const recorder = recorderRef.current;
    if (!recorder || recorder.state === "inactive") {
      return;
    }

    recorder.stop();
  }, []);

  const startRecording = useCallback(async () => {
    if (!isSupported) {
      setError("This browser does not support audio recording.");
      return;
    }

    try {
      reset();
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const supportedMimeType = getSupportedMimeType();
      const recorder = supportedMimeType
        ? new MediaRecorder(stream, { mimeType: supportedMimeType })
        : new MediaRecorder(stream);

      chunksRef.current = [];
      timedChunksRef.current = [];
      startedAtRef.current = Date.now();
      setMimeType(recorder.mimeType || supportedMimeType || "audio/webm");
      setIsRecording(true);

      const AudioContextCtor =
        window.AudioContext ||
        (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;

      if (AudioContextCtor) {
        const audioContext = new AudioContextCtor();
        const analyser = audioContext.createAnalyser();
        const source = audioContext.createMediaStreamSource(stream);

        analyser.fftSize = 2048;
        analyser.smoothingTimeConstant = 0.85;
        source.connect(analyser);

        audioContextRef.current = audioContext;
        analyserRef.current = analyser;

        const buffer = new Uint8Array(analyser.fftSize);
        const monitor = () => {
          const activeAnalyser = analyserRef.current;
          if (!activeAnalyser) {
            return;
          }

          activeAnalyser.getByteTimeDomainData(buffer);

          let sum = 0;
          for (const value of buffer) {
            const normalized = (value - 128) / 128;
            sum += normalized * normalized;
          }

          const rms = Math.sqrt(sum / buffer.length);
          setAudioLevel(rms);

          const now = Date.now();
          if (rms >= 0.02) {
            lastSpeechAtRef.current = now;
            hasSpokenRef.current = true;
            setHasSpoken(true);
            setSilenceDurationMs(0);
          } else if (hasSpokenRef.current && lastSpeechAtRef.current) {
            setSilenceDurationMs(now - lastSpeechAtRef.current);
          } else {
            setSilenceDurationMs(0);
          }

          monitorFrameRef.current = window.requestAnimationFrame(monitor);
        };

        monitorFrameRef.current = window.requestAnimationFrame(monitor);
      }

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
          timedChunksRef.current = [
            ...timedChunksRef.current,
            {
              blob: event.data,
              createdAt: Date.now(),
            },
          ].filter((item) => item.createdAt >= Date.now() - 45000);
        }
      };

      recorder.onstop = () => {
        const finalMimeType =
          recorder.mimeType || supportedMimeType || "audio/webm";
        const blob = new Blob(chunksRef.current, { type: finalMimeType });

        clearPreview();
        const objectUrl = URL.createObjectURL(blob);
        objectUrlRef.current = objectUrl;

        setAudioBlob(blob);
        setAudioUrl(objectUrl);
        setIsRecording(false);
        stopMonitoring();
        stopTracks();
      };

      recorderRef.current = recorder;
      recorder.start(1000);
    } catch (recorderError) {
      const message =
        recorderError instanceof Error
          ? recorderError.message
          : "Microphone access was not granted.";
      setError(message);
      stopTracks();
      stopMonitoring();
      setIsRecording(false);
    }
  }, [clearPreview, isSupported, reset, stopMonitoring, stopTracks]);

  useEffect(() => {
    if (!isRecording) {
      return;
    }

    const intervalId = window.setInterval(() => {
      if (!startedAtRef.current) {
        return;
      }

      setElapsedSeconds(
        Math.max(0, Math.floor((Date.now() - startedAtRef.current) / 1000)),
      );
    }, 250);

    return () => window.clearInterval(intervalId);
  }, [isRecording]);

  useEffect(() => {
    return () => {
      stopTracks();
      stopMonitoring();
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
      }
    };
  }, [stopMonitoring, stopTracks]);

  const getRecentAudioBlob = useCallback(
    (windowMs = 14000) => {
      const cutoff = Date.now() - windowMs;
      const relevant = timedChunksRef.current.filter((item) => item.createdAt >= cutoff);
      if (relevant.length === 0) {
        return null;
      }

      return new Blob(
        relevant.map((item) => item.blob),
        { type: mimeType || "audio/webm" },
      );
    },
    [mimeType],
  );

  return {
    audioBlob,
    audioLevel,
    audioUrl,
    elapsedSeconds,
    error,
    getRecentAudioBlob,
    hasSpoken,
    isRecording,
    isSupported,
    mimeType,
    reset,
    silenceDurationMs,
    startRecording,
    stopRecording,
  };
}
