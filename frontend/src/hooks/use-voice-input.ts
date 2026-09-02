"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";

export const VOICE_LANGUAGES = { en: "en-IN", hi: "hi-IN" } as const;
export type VoiceInputStatus = "idle" | "listening" | "processing" | "error";
export type VoiceInputError = "permission" | "unsupported" | "understand" | "unavailable";

export function getVoiceLanguage(locale: string): string {
  return VOICE_LANGUAGES[locale as keyof typeof VOICE_LANGUAGES] ?? VOICE_LANGUAGES.en;
}

export function voiceErrorMessage(error: unknown): VoiceInputError {
  if (error === "not-allowed" || error === "service-not-allowed") return "permission";
  if (error === "audio-capture" || error === "network") return "unsupported";
  if (error === "no-speech") return "understand";
  if (error === undefined) return "understand";
  if (error instanceof DOMException && error.name === "NotAllowedError") return "permission";
  if (error instanceof DOMException && error.name === "NotSupportedError") return "unsupported";
  if (error instanceof TypeError) return "unsupported";
  return "unavailable";
}

function getSupportedMimeType() {
  if (typeof MediaRecorder === "undefined") return null;
  return ["audio/webm;codecs=opus", "audio/webm", "audio/ogg;codecs=opus", "audio/ogg"]
    .find((type) => MediaRecorder.isTypeSupported(type)) ?? null;
}

export function useVoiceInput({
  locale,
  onTranscript,
  onError,
  maxDurationMs = 20_000,
}: {
  locale: string;
  onTranscript: (text: string) => void;
  onError: (kind: VoiceInputError) => void;
  maxDurationMs?: number;
}) {
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onTranscriptRef = useRef(onTranscript);
  const onErrorRef = useRef(onError);
  const [status, setStatus] = useState<VoiceInputStatus>("idle");
  const [isSupported, setIsSupported] = useState(true);

  useEffect(() => {
    onTranscriptRef.current = onTranscript;
    onErrorRef.current = onError;
  }, [onTranscript, onError]);

  useEffect(() => {
    setIsSupported(
      typeof navigator !== "undefined" &&
      Boolean(navigator.mediaDevices?.getUserMedia) &&
      typeof MediaRecorder !== "undefined" &&
      Boolean(getSupportedMimeType()),
    );
  }, []);

  const clearTimer = useCallback(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = null;
  }, []);

  const releaseStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }, []);

  const stop = useCallback(() => {
    clearTimer();
    if (recorderRef.current?.state === "recording") recorderRef.current.stop();
  }, [clearTimer]);

  const start = useCallback(async () => {
    if (status === "listening" || status === "processing") return;
    const mimeType = getSupportedMimeType();
    if (!navigator.mediaDevices?.getUserMedia || !mimeType) {
      setIsSupported(false);
      onErrorRef.current("unsupported");
      setStatus("error");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream, { mimeType });
      chunksRef.current = [];
      streamRef.current = stream;
      recorderRef.current = recorder;
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };
      recorder.onerror = () => {
        releaseStream();
        setStatus("error");
        onErrorRef.current("unavailable");
      };
      recorder.onstop = async () => {
        clearTimer();
        releaseStream();
        recorderRef.current = null;
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || mimeType });
        chunksRef.current = [];
        if (!blob.size) {
          setStatus("error");
          onErrorRef.current("understand");
          return;
        }
        setStatus("processing");
        try {
          const body = new FormData();
          body.append("audio", blob, "finai-voice.webm");
          body.append("language", getVoiceLanguage(locale));
          const result = await api.post<{ text: string; language: string }>("/voice/stt", body, { timeout: 35_000 });
          if (result.text.trim()) onTranscriptRef.current(result.text.trim());
          else onErrorRef.current("understand");
          setStatus("idle");
        } catch (error) {
          setStatus("error");
          onErrorRef.current(voiceErrorMessage(error));
        }
      };
      recorder.start();
      setStatus("listening");
      timeoutRef.current = setTimeout(() => recorder.stop(), maxDurationMs);
    } catch (error) {
      releaseStream();
      setStatus("error");
      onErrorRef.current(voiceErrorMessage(error));
    }
  }, [clearTimer, locale, maxDurationMs, releaseStream, status]);

  const toggle = useCallback(() => {
    if (status === "listening") stop();
    else if (status === "idle" || status === "error") void start();
  }, [start, status, stop]);

  useEffect(() => () => {
    clearTimer();
    if (recorderRef.current?.state === "recording") recorderRef.current.stop();
    releaseStream();
  }, [clearTimer, releaseStream]);

  return { status, isListening: status === "listening", isProcessing: status === "processing", isSupported, start, stop, toggle };
}
