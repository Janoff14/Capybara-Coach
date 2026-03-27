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
  const startedAtRef = useRef<number | null>(null);
  const objectUrlRef = useRef<string | null>(null);

  const [isRecording, setIsRecording] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [mimeType, setMimeType] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

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

  const stopTracks = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }, []);

  const reset = useCallback(() => {
    clearPreview();
    setMimeType(null);
    setElapsedSeconds(0);
    setError(null);
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
      startedAtRef.current = Date.now();
      setMimeType(recorder.mimeType || supportedMimeType || "audio/webm");
      setIsRecording(true);

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
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
        stopTracks();
      };

      recorderRef.current = recorder;
      recorder.start();
    } catch (recorderError) {
      const message =
        recorderError instanceof Error
          ? recorderError.message
          : "Microphone access was not granted.";
      setError(message);
      stopTracks();
      setIsRecording(false);
    }
  }, [clearPreview, isSupported, reset, stopTracks]);

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
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
      }
    };
  }, [stopTracks]);

  return {
    audioBlob,
    audioUrl,
    elapsedSeconds,
    error,
    isRecording,
    isSupported,
    mimeType,
    reset,
    startRecording,
    stopRecording,
  };
}
