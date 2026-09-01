"use client";

import { useEffect, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { motion, AnimatePresence } from "framer-motion";
import { MessageCircle, X, Send, Minimize2 } from "lucide-react";
import { format } from "date-fns";
import { useChatStore } from "@/stores/chat-store";
import { useUIStore } from "@/stores/ui-store";
import { api } from "@/lib/api";
import { generateFollowUps, type DashboardContext } from "@/lib/chat-followups";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api/v1";

export function FinAIChat() {
  const t = useTranslations("chat");
  const locale = useLocale();
  const { isOpen, isFullscreen, setOpen, setFullscreen, messages, addMessage, isLoading, setLoading, sessionId, setSessionId, draft, setDraft } = useChatStore();
  const [input, setInput] = useState("");
  const [followUps, setFollowUps] = useState<string[]>([]);
  const lastFollowUpsRef = useRef<string[]>([]);
  const dashboardContextRef = useRef<DashboardContext | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const finaiEnabled = useUIStore((s) => s.finaiEnabled);
  const followUpsEnabled = useUIStore((s) => s.followUpsEnabled);
  const aiDetail = useUIStore((s) => s.aiDetail);
  const aiFocus = useUIStore((s) => s.aiFocus);

  const suggestions = [
    t("suggestions.save"),
    t("suggestions.expenses"),
    t("suggestions.loan"),
    t("suggestions.price"),
    t("suggestions.stock"),
    t("suggestions.idea"),
    t("suggestions.readiness"),
    t("suggestions.alternatives"),
  ];

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  useEffect(() => {
    if (!isOpen || dashboardContextRef.current) return;
    let active = true;
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/financial-health`, {
          headers: { Authorization: `Bearer ${api.getAccessToken()}` },
          credentials: "include",
        });
        if (!active || !res.ok) return;
        const data = (await res.json()) as { score?: number; label?: string };
        if (typeof data.score === "number") {
          dashboardContextRef.current = {
            healthScore: data.score,
            healthLabel: data.label ?? undefined,
          };
        }
      } catch {
        // context stays empty → default follow-up behaviour
      }
    })();
    return () => {
      active = false;
    };
  }, [isOpen]);

  const activeDraft = isOpen ? draft : null;
  const value = activeDraft ?? input;

  const sendMessage = async (text: string) => {
    if (!text.trim() || isLoading) return;
    const userMsg = { id: crypto.randomUUID(), role: "user" as const, content: text, timestamp: new Date() };
    addMessage(userMsg);
    setInput("");
    setDraft(null);
    setFollowUps([]);
    setLoading(true);
    const assistantTurn = messages.filter((m) => m.role === "assistant").length;

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 120_000);

      const res = await fetch(`${API_BASE}/chat/stream`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${api.getAccessToken()}`,
        },
        credentials: "include",
        body: JSON.stringify({ message: text, session_id: sessionId, language: locale, detail: aiDetail, focus: aiFocus }),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (!res.ok || !res.body) {
        let errorMsg = "FinAI is temporarily unavailable. Please try again.";
        try {
          const errorData = await res.json().catch(() => null);
          if (res.status === 403) {
            errorMsg = "You need to grant consent for financial analysis. Please visit your settings.";
          } else if (res.status === 429) {
            errorMsg = "Too many requests. Please wait a moment and try again.";
          } else if (res.status === 503) {
            errorMsg = errorData?.error?.message ?? "FinAI is temporarily unavailable. Please try again.";
          } else if (errorData?.error?.message) {
            errorMsg = errorData.error.message;
          }
        } catch { /* use default message */ }

        try {
          const fallback = await api.post<{ reply: string; session_id: number }>(
            "/chat",
            {
              message: text,
              session_id: sessionId,
              language: locale,
              detail: aiDetail,
              focus: aiFocus,
            },
            { timeout: 90_000 },
          );
          setSessionId(fallback.session_id);
          addMessage({ id: crypto.randomUUID(), role: "assistant", content: fallback.reply, timestamp: new Date() });
          const next = followUpsEnabled
            ? generateFollowUps(text, fallback.reply, assistantTurn, lastFollowUpsRef.current, dashboardContextRef.current ?? {})
            : [];
          lastFollowUpsRef.current = next;
          setFollowUps(next);
        } catch {
          addMessage({ id: crypto.randomUUID(), role: "assistant", content: errorMsg, timestamp: new Date() });
        }
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let assistantText = "";
      const assistantId = crypto.randomUUID();
      let streamDone = false;
      let lineBuffer = "";
      const streamTimeout = setTimeout(() => {
        reader.cancel("Stream timeout").catch(() => {});
      }, 120_000);

      try {
        while (!streamDone) {
          const { done, value } = await reader.read();
          if (done) break;
          lineBuffer += decoder.decode(value, { stream: true });
          const lines = lineBuffer.split("\n");
          lineBuffer = lines.pop() ?? "";
          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed.startsWith("data: ")) continue;
            const payload = trimmed.slice(6);
            if (payload === "[DONE]") {
              streamDone = true;
              break;
            }
            try {
              const parsed = JSON.parse(payload);
              if (parsed.delta) assistantText += parsed.delta;
              if (parsed.session_id) setSessionId(parsed.session_id);
            } catch { /* skip malformed chunks */ }
          }
        }
      } finally {
        clearTimeout(streamTimeout);
      }

      const finalReply = assistantText || "I wasn't able to generate a response. Please try rephrasing your question.";
      addMessage({ id: assistantId, role: "assistant", content: finalReply, timestamp: new Date() });
      const next = followUpsEnabled
        ? generateFollowUps(text, finalReply, assistantTurn, lastFollowUpsRef.current, dashboardContextRef.current ?? {})
        : [];
      lastFollowUpsRef.current = next;
      setFollowUps(next);
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        addMessage({ id: crypto.randomUUID(), role: "assistant", content: "The request timed out. Please try again.", timestamp: new Date() });
      } else {
        const msg = err instanceof TypeError && err.message.includes("fetch")
          ? "Unable to connect to FinAI. Please check your connection."
          : "Unable to reach FinAI. Please try again.";
        addMessage({ id: crypto.randomUUID(), role: "assistant", content: msg, timestamp: new Date() });
      }
    } finally {
      setLoading(false);
    }
  };

  if (!finaiEnabled) return null;

  return (
    <>
      {!isOpen && (
        <button
          className="fab-chat fixed bottom-16 right-4 z-50 h-12 w-12 rounded-full bg-primary text-primary-foreground shadow-lg lg:bottom-5 flex items-center justify-center"
          onClick={() => setOpen(true)}
          aria-label={t("title")}
        >
          <MessageCircle className="h-5 w-5" />
        </button>
      )}

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className={cn(
              "fixed z-50 flex flex-col glass-panel shadow-lg",
              isFullscreen
                ? "inset-0 rounded-none"
                : "bottom-16 right-4 left-4 h-[min(70vh,32rem)] rounded-2xl lg:bottom-5 lg:left-auto lg:w-96",
            )}
          >
            <div className="flex items-center justify-between border-b border-border-subtle px-4 py-2.5">
              <h2 className="font-semibold text-[14px] text-text-primary">{t("title")}</h2>
              <div className="flex gap-0.5">
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setFullscreen(!isFullscreen)} aria-label={isFullscreen ? t("exitFullscreen") : t("fullscreen")}>
                  <Minimize2 className="h-3.5 w-3.5" />
                </Button>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setOpen(false)} aria-label={t("close")}>
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {messages.length === 0 && (
                <div className="space-y-2">
                  <p className="text-[12px] text-text-muted leading-relaxed">{t("disclaimer")}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {suggestions.map((s) => (
                      <button
                        key={s}
                        className="rounded-full border border-border-subtle px-3 py-1 text-[11px] text-text-muted hover:bg-surface-container-high/60 hover:text-text-primary transition-colors"
                        onClick={() => sendMessage(s)}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {messages.map((m) => (
                <div key={m.id} className={cn("flex flex-col", m.role === "user" ? "items-end" : "items-start")}>
                  <div
                    className={cn(
                      "max-w-[88%] rounded-2xl px-4 py-2.5 text-[13.5px] leading-relaxed break-words",
                      m.role === "user"
                        ? "bg-primary text-primary-foreground font-medium rounded-br-sm shadow-sm"
                        : "bg-surface-container-high border border-border-subtle text-text-primary whitespace-pre-wrap rounded-bl-sm",
                    )}
                  >
                    {m.content}
                  </div>
                  <span className={cn("mt-0.5 px-1 text-[10px] text-text-muted/70 tabular-nums", m.role === "user" ? "text-right" : "text-left")}>
                    {format(m.timestamp, "HH:mm")}
                  </span>
                </div>
              ))}
              {isLoading && (
                <div className="flex justify-start">
                  <div className="rounded-2xl rounded-bl-sm bg-surface-container-high border border-border-subtle px-4 py-2.5 text-[13.5px] text-text-muted animate-pulse">
                    FinAI is thinking...
                  </div>
                </div>
              )}
              {!isLoading && followUpsEnabled && followUps.length > 0 && messages[messages.length - 1]?.role === "assistant" && (
                <motion.div
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.25, ease: "easeOut" }}
                  className="flex flex-wrap gap-1.5 pt-1"
                  aria-label={t("suggestions.title")}
                >
                  {followUps.map((s) => (
                    <button
                      key={s}
                      className="rounded-full border border-border-subtle px-3 py-1 text-[11px] text-text-muted hover:bg-surface-container-high/60 hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring transition-colors"
                      onClick={() => sendMessage(s)}
                    >
                      {s}
                    </button>
                  ))}
                </motion.div>
              )}
              <div ref={bottomRef} />
            </div>

            <form
              className="flex gap-2 border-t border-border-subtle p-3"
              onSubmit={(e) => { e.preventDefault(); sendMessage(value); }}
            >
              <Input
                value={value}
                onChange={(e) => {
                  if (activeDraft != null) setDraft(null);
                  setInput(e.target.value);
                }}
                placeholder={t("placeholder")}
                disabled={isLoading}
                className="h-9 text-[13px]"
              />
              <Button type="submit" size="icon" className="h-9 w-9 shrink-0" disabled={isLoading || !value.trim()} aria-label={t("send")}>
                <Send className="h-4 w-4" />
              </Button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
