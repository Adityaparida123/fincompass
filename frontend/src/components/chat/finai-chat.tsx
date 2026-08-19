"use client";

import { useEffect, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { motion, AnimatePresence } from "framer-motion";
import { MessageCircle, X, Send, Minimize2 } from "lucide-react";
import { useChatStore } from "@/stores/chat-store";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api/v1";

export function FinAIChat() {
  const t = useTranslations("chat");
  const locale = useLocale();
  const { isOpen, isFullscreen, setOpen, setFullscreen, messages, addMessage, isLoading, setLoading, sessionId, setSessionId } = useChatStore();
  const [input, setInput] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  const suggestions = [
    t("suggestions.save"),
    t("suggestions.expenses"),
    t("suggestions.loan"),
    t("suggestions.readiness"),
    t("suggestions.biggest"),
    t("suggestions.alternatives"),
  ];

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  const sendMessage = async (text: string) => {
    if (!text.trim() || isLoading) return;
    const userMsg = { id: crypto.randomUUID(), role: "user" as const, content: text, timestamp: new Date() };
    addMessage(userMsg);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch(`${API_BASE}/chat/stream`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${api.getAccessToken()}`,
        },
        credentials: "include",
        body: JSON.stringify({ message: text, session_id: sessionId, language: locale }),
      });

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
            },
            { timeout: 90_000 },
          );
          setSessionId(fallback.session_id);
          addMessage({ id: crypto.randomUUID(), role: "assistant", content: fallback.reply, timestamp: new Date() });
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

      addMessage({ id: assistantId, role: "assistant", content: assistantText || "I wasn't able to generate a response. Please try rephrasing your question.", timestamp: new Date() });
    } catch (err) {
      const msg = err instanceof TypeError && err.message.includes("fetch")
        ? "Unable to connect to FinAI. Please check your connection."
        : "Unable to reach FinAI. Please try again.";
      addMessage({ id: crypto.randomUUID(), role: "assistant", content: msg, timestamp: new Date() });
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {!isOpen && (
        <Button
          className="fixed bottom-20 right-4 z-50 h-14 w-14 rounded-full shadow-lg lg:bottom-6"
          size="icon"
          onClick={() => setOpen(true)}
          aria-label={t("title")}
        >
          <MessageCircle className="h-6 w-6" />
        </Button>
      )}

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className={cn(
              "fixed z-50 flex flex-col border border-border-subtle bg-surface-card shadow-2xl",
              isFullscreen
                ? "inset-0"
                : "bottom-20 right-4 left-4 h-[min(70vh,32rem)] rounded-2xl lg:bottom-6 lg:left-auto lg:w-96",
            )}
          >
            <div className="flex items-center justify-between border-b px-4 py-3">
              <h2 className="font-semibold">{t("title")}</h2>
              <div className="flex gap-1">
                <Button variant="ghost" size="icon" onClick={() => setFullscreen(!isFullscreen)}>
                  <Minimize2 className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" onClick={() => setOpen(false)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {messages.length === 0 && (
                <div className="space-y-2">
                  <p className="text-sm text-text-muted">{t("disclaimer")}</p>
                  <div className="flex flex-wrap gap-2">
                    {suggestions.map((s) => (
                      <button
                        key={s}
                        className="rounded-full border border-border-subtle px-3 py-1.5 text-xs hover:bg-surface-container-high transition-colors"
                        onClick={() => sendMessage(s)}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {messages.map((m) => (
                <div key={m.id} className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}>
                  <div
                    className={cn(
                      "max-w-[85%] rounded-2xl px-4 py-2 text-sm",
                      m.role === "user" ? "bg-primary text-on-primary-container" : "bg-surface-container",
                    )}
                  >
                    {m.content}
                  </div>
                </div>
              ))}
              {isLoading && (
                <div className="flex justify-start">
                  <div className="rounded-2xl bg-surface-container px-4 py-2 text-sm text-text-muted animate-pulse">
                    FinAI is thinking...
                  </div>
                </div>
              )}
              <div ref={bottomRef} />
            </div>

            <form
              className="flex gap-2 border-t border-border-subtle p-3"
              onSubmit={(e) => { e.preventDefault(); sendMessage(input); }}
            >
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={t("placeholder")}
                disabled={isLoading}
              />
              <Button type="submit" size="icon" disabled={isLoading || !input.trim()}>
                <Send className="h-4 w-4" />
              </Button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
