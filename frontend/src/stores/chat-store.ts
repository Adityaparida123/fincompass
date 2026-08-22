"use client";

import { create } from "zustand";

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

interface ChatState {
  isOpen: boolean;
  isFullscreen: boolean;
  sessionId: number | null;
  messages: ChatMessage[];
  isLoading: boolean;
  draft: string | null;
  setOpen: (open: boolean) => void;
  setFullscreen: (v: boolean) => void;
  setSessionId: (id: number | null) => void;
  addMessage: (msg: ChatMessage) => void;
  setMessages: (msgs: ChatMessage[]) => void;
  setLoading: (v: boolean) => void;
  setDraft: (text: string | null) => void;
  clearChat: () => void;
}

export const useChatStore = create<ChatState>((set) => ({
  isOpen: false,
  isFullscreen: false,
  sessionId: null,
  messages: [],
  isLoading: false,
  draft: null,
  setOpen: (open) => set({ isOpen: open }),
  setFullscreen: (v) => set({ isFullscreen: v }),
  setSessionId: (id) => set({ sessionId: id }),
  addMessage: (msg) => set((s) => ({ messages: [...s.messages, msg] })),
  setMessages: (msgs) => set({ messages: msgs }),
  setLoading: (v) => set({ isLoading: v }),
  setDraft: (text) => set({ draft: text }),
  clearChat: () => set({ messages: [], sessionId: null }),
}));
