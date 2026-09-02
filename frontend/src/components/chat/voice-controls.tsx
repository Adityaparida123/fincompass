"use client";

import { Mic, MicOff, Volume2, Square } from "lucide-react";
import { useState } from "react";
import { useVoiceInput, type VoiceInputError } from "@/hooks/use-voice-input";
import { useVoiceOutput } from "@/hooks/use-voice-output";
import { cn } from "@/lib/utils";

export function VoiceInputControl({
  locale,
  onTranscript,
  labels,
}: {
  locale: string;
  onTranscript: (text: string) => void;
  labels: {
    start: string;
    stop: string;
    listening: string;
    requesting: string;
    processing: string;
    permission: string;
    noMicrophone: string;
    unsupported: string;
    understand: string;
    stt: string;
    network: string;
    unavailable: string;
  };
}) {
  const [error, setError] = useState<VoiceInputError | null>(null);
  const voice = useVoiceInput({
    locale,
    onTranscript: (text) => {
      setError(null);
      onTranscript(text);
    },
    onError: setError,
  });

  const debugEnabled = process.env.NODE_ENV !== "production";
  const debugStatus = voice.diagnostics.stt === "success"
    ? `STT: Success (${voice.diagnostics.transcriptLength} chars)`
    : voice.diagnostics.stt === "processing"
      ? "STT: Processing"
      : voice.diagnostics.stt === "error"
        ? "STT: Error"
        : "";

  const statusText = (() => {
    if (voice.isListening) return labels.listening;
    if (voice.status === "requesting") return labels.requesting;
    if (voice.isProcessing) return labels.processing;
    if (error === "permission") return labels.permission;
    if (error === "no-microphone") return labels.noMicrophone;
    if (error === "unsupported") return labels.unsupported;
    if (error === "network") return labels.network;
    if (error === "stt") return labels.stt;
    if (error === "unavailable") return labels.unavailable;
    if (error === "empty") return labels.understand;
    return null;
  })();

  return (
    <div className="flex min-w-0 items-center gap-1.5">
      {voice.isListening && (
        <span className="flex h-6 items-center gap-0.5 px-1" aria-hidden="true">
          {["h-2", "h-4", "h-3", "h-5", "h-2"].map((height, index) => (
            <span
              key={index}
              className={cn("w-0.5 rounded-full bg-rose-400", height, "animate-pulse")}
              style={{ animationDelay: `${index * 90}ms` }}
            />
          ))}
        </span>
      )}
      {statusText && (
        <span className="max-w-[180px] truncate text-[10px] text-text-muted" role="status">
          {statusText}
        </span>
      )}
      {debugEnabled && (voice.diagnostics.recording || voice.diagnostics.audioBytes > 0 || debugStatus) && (
        <span className="max-w-[160px] truncate text-[9px] text-text-muted/80" role="status">
          Mic: {voice.diagnostics.microphone === "granted" ? "Connected" : "Unavailable"} · Audio: {voice.diagnostics.audioBytes}B · {debugStatus || "Ready"}
        </span>
      )}
      <button
        type="button"
        onClick={() => {
          if (debugEnabled) console.info("[VOICE DEBUG] button clicked");
          voice.toggle();
        }}
        disabled={!voice.isSupported || voice.isProcessing || voice.status === "requesting"}
        className={cn(
          "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          voice.isListening
            ? "border-rose-400/50 bg-rose-500/10 text-rose-400"
            : "border-border-subtle text-text-muted hover:border-primary/40 hover:text-primary",
        )}
        aria-label={voice.isListening ? labels.stop : voice.status === "requesting" ? labels.requesting : labels.start}
        title={voice.isListening ? labels.stop : voice.status === "requesting" ? labels.requesting : labels.start}
      >
        {voice.isListening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
      </button>
    </div>
  );
}

export function VoiceOutputControl({
  text,
  locale,
  labels,
}: {
  text: string;
  locale: string;
  labels: { speak: string; stop: string; loading: string; unavailable: string };
}) {
  const voice = useVoiceOutput(locale);
  const isSpeaking = voice.isSpeaking;

  return (
    <button
      type="button"
      onClick={() => (isSpeaking ? voice.stop() : voice.speak(text))}
      disabled={!voice.isSupported || voice.isLoading}
      className="mt-1 inline-flex items-center gap-1 rounded px-1 py-0.5 text-[10px] text-text-muted transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
      aria-label={isSpeaking ? labels.stop : labels.speak}
      title={isSpeaking ? labels.stop : labels.speak}
    >
      {isSpeaking ? <Square className="h-3 w-3" /> : <Volume2 className="h-3 w-3" />}
      <span>{!voice.isSupported || voice.status === "error" ? labels.unavailable : voice.isLoading ? labels.loading : isSpeaking ? labels.stop : labels.speak}</span>
    </button>
  );
}
