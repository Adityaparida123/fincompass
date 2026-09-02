"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import { getVoiceLanguage } from "@/hooks/use-voice-input";

export type VoiceOutputStatus = "idle" | "loading" | "playing" | "error";

export function useVoiceOutput(locale: string) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const urlRef = useRef<string | null>(null);
  const [status, setStatus] = useState<VoiceOutputStatus>("idle");

  const cleanup = useCallback(() => {
    audioRef.current?.pause();
    audioRef.current = null;
    if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    urlRef.current = null;
  }, []);

  const stop = useCallback(() => {
    cleanup();
    setStatus("idle");
  }, [cleanup]);

  const speak = useCallback(async (text: string) => {
    if (!text.trim() || status === "loading") return;
    stop();
    setStatus("loading");
    try {
      const blob = await api.postBlob("/voice/tts", {
        text: text.trim(),
        language: getVoiceLanguage(locale),
      }, { timeout: 35_000 });
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      urlRef.current = url;
      audioRef.current = audio;
      audio.onplay = () => setStatus("playing");
      audio.onended = () => {
        cleanup();
        setStatus("idle");
      };
      audio.onerror = () => {
        cleanup();
        setStatus("error");
      };
      await audio.play();
    } catch {
      cleanup();
      setStatus("error");
    }
  }, [cleanup, locale, status, stop]);

  useEffect(() => () => cleanup(), [cleanup]);

  return {
    status,
    isLoading: status === "loading",
    isSpeaking: status === "playing",
    isSupported: true,
    speak,
    stop,
  };
}
