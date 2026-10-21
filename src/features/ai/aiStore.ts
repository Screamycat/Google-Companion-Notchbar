import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { createStore } from "../../lib/store";
import { triggerCompanionMood, type CompanionMood } from "../companion/companionBrain";
import { buildEmotionPrompt, scanAndTriggerEmotions, stripEmotionTags } from "./emotionParser";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: number;
  emotionLabel?: string | null;
  isError?: boolean;
}

export interface GeminiStatusPayload {
  initialized: boolean;
  authenticated: boolean;
  account: string | null;
  model: string | null;
  windowVisible: boolean;
}

type NotchGeminiEvent =
  | ({ type: "status" } & GeminiStatusPayload)
  | { type: "thinking"; requestId: string }
  | { type: "stream"; requestId: string; text: string; done: boolean }
  | { type: "error"; requestId?: string | null; message: string };

export const aiHistoryStore = createStore<{
  messages: ChatMessage[];
  hasConnectedBefore?: boolean;
}>(
  { messages: [], hasConnectedBefore: false },
  {
    persist: "gemini-chat-history",
    normalize: (loaded) => ({
      messages: Array.isArray(loaded?.messages) ? loaded.messages.slice(-40) : [],
      hasConnectedBefore: Boolean(loaded?.hasConnectedBefore),
    }),
  }
);

export interface AiSessionState {
  initialized: boolean;
  authenticated: boolean;
  account: string | null;
  model: string | null;
  windowVisible: boolean;
  status: "idle" | "thinking" | "streaming" | "error";
  activeRequestId: string | null;
  liveEmotionLabel: string | null;
  liveMood: CompanionMood | null;
  currentHeight: number;
}

export const aiSessionStore = createStore<AiSessionState>({
  initialized: false,
  authenticated: false,
  account: null,
  model: null,
  windowVisible: false,
  status: "idle",
  activeRequestId: null,
  liveEmotionLabel: null,
  liveMood: null,
  currentHeight: 232,
});

const isNative = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
let listenerAttached = false;
let activeSeenEmotions = 0;

function attachListenerOnce() {
  if (listenerAttached || !isNative) return;
  listenerAttached = true;

  void listen<NotchGeminiEvent>("notch://gemini", (ev) => {
    const payload = ev.payload;
    if (!payload) return;

    if (payload.type === "status") {
      if (payload.authenticated && !aiHistoryStore.get().hasConnectedBefore) {
        aiHistoryStore.set((prev) => ({ ...prev, hasConnectedBefore: true }));
      }
      aiSessionStore.set((prev) => ({
        ...prev,
        initialized: payload.initialized,
        authenticated: payload.authenticated,
        account: payload.account ?? prev.account,
        model: payload.model ?? prev.model,
        windowVisible: payload.windowVisible,
      }));
      return;
    }

    const currentReqId = aiSessionStore.get().activeRequestId;
    if ("requestId" in payload && payload.requestId && currentReqId && payload.requestId !== currentReqId) {
      return;
    }

    if (payload.type === "thinking") {
      aiSessionStore.set((prev) => ({
        ...prev,
        status: "thinking",
        liveEmotionLabel: "Thinking",
        liveMood: "studying",
      }));
      triggerCompanionMood("studying", 3200);
      return;
    }

    if (payload.type === "stream") {
      const scan = scanAndTriggerEmotions(payload.text, activeSeenEmotions);
      activeSeenEmotions = scan.seenCount;

      const cleanText = stripEmotionTags(payload.text, !payload.done);

      aiHistoryStore.set((prev) => {
        const next = [...prev.messages];
        const idx = next.findIndex((m) => m.id === payload.requestId);
        if (idx !== -1) {
          next[idx] = {
            ...next[idx],
            content: cleanText,
            emotionLabel: scan.label ?? next[idx].emotionLabel,
          };
        }
        return { ...prev, messages: next };
      });

      if (payload.done) {
        if (scan.seenCount === 0) {
          triggerCompanionMood("happy", 1800);
        }
        aiSessionStore.set((prev) => ({
          ...prev,
          status: "idle",
          activeRequestId: null,
          liveEmotionLabel: scan.label ?? "Happy",
          liveMood: scan.mood ?? "happy",
        }));
        window.setTimeout(() => {
          aiSessionStore.set((prev) => {
            if (prev.status === "idle") {
              return { ...prev, liveEmotionLabel: null, liveMood: null };
            }
            return prev;
          });
        }, 3500);
      } else {
        aiSessionStore.set((prev) => ({
          ...prev,
          status: "streaming",
          liveEmotionLabel: scan.label ?? prev.liveEmotionLabel ?? "Speaking",
          liveMood: scan.mood ?? prev.liveMood,
        }));
      }
      return;
    }

    if (payload.type === "error") {
      triggerCompanionMood("sad", 2200);
      aiHistoryStore.set((prev) => {
        const next = [...prev.messages];
        const idx = payload.requestId ? next.findIndex((m) => m.id === payload.requestId) : next.length - 1;
        if (idx !== -1 && next[idx]?.role === "assistant") {
          next[idx] = {
            ...next[idx],
            content: payload.message,
            isError: true,
            emotionLabel: "Sorry",
          };
        }
        return { ...prev, messages: next };
      });
      aiSessionStore.set((prev) => ({
        ...prev,
        status: "idle",
        activeRequestId: null,
        liveEmotionLabel: null,
        liveMood: "sad",
      }));
    }
  });
}

export async function initGeminiBridge(): Promise<void> {
  attachListenerOnce();
  if (!isNative) return;
  try {
    const autoConnect = Boolean(aiHistoryStore.get().hasConnectedBefore);
    const status = await invoke<GeminiStatusPayload>("gemini_init", { autoConnect });
    aiSessionStore.set((prev) => ({
      ...prev,
      initialized: status.initialized,
      authenticated: status.authenticated,
      account: status.account ?? prev.account,
      model: status.model ?? prev.model,
      windowVisible: status.windowVisible,
    }));
  } catch {
    // Ignore init errors in browser preview
  }
}

export async function openGeminiWindow(): Promise<void> {
  attachListenerOnce();
  if (!isNative) return;
  try {
    const status = await invoke<GeminiStatusPayload>("gemini_open_window");
    aiSessionStore.set((prev) => ({
      ...prev,
      initialized: status.initialized,
      authenticated: status.authenticated,
      account: status.account ?? prev.account,
      model: status.model ?? prev.model,
      windowVisible: status.windowVisible,
    }));
  } catch {
    // Ignore
  }
}

export async function sendGeminiMessage(rawPrompt: string): Promise<void> {
  const trimmed = rawPrompt.trim();
  if (!trimmed) return;

  attachListenerOnce();

  const userMsgId = `user-${Date.now()}`;
  const reqId = `assistant-${Date.now() + 1}`;
  activeSeenEmotions = 0;

  aiHistoryStore.set((prev) => ({
    ...prev,
    messages: [
      ...prev.messages.slice(-38),
      {
        id: userMsgId,
        role: "user",
        content: trimmed,
        timestamp: Date.now(),
      },
      {
        id: reqId,
        role: "assistant",
        content: "",
        timestamp: Date.now(),
        emotionLabel: "Curious",
      },
    ],
  }));

  aiSessionStore.set((prev) => ({
    ...prev,
    status: "thinking",
    activeRequestId: reqId,
    liveEmotionLabel: "Curious",
    liveMood: "curious",
  }));

  triggerCompanionMood("curious", 2200);

  if (!isNative) return;

  try {
    const wrappedPrompt = buildEmotionPrompt(trimmed);
    await invoke("gemini_send", {
      prompt: wrappedPrompt,
      requestId: reqId,
    });
  } catch (err) {
    const msg = typeof err === "string" ? err : "Failed to send message to Gemini Web session.";
    aiHistoryStore.set((prev) => ({
      ...prev,
      messages: prev.messages.map((m) =>
        m.id === reqId ? { ...m, content: msg, isError: true } : m
      ),
    }));
    aiSessionStore.set((prev) => ({
      ...prev,
      status: "idle",
      activeRequestId: null,
    }));
  }
}

export async function stopGeminiGeneration(): Promise<void> {
  aiSessionStore.set((prev) => ({
    ...prev,
    status: "idle",
    activeRequestId: null,
    liveEmotionLabel: null,
  }));
  if (!isNative) return;
  try {
    await invoke("gemini_abort");
  } catch {
    // Ignore
  }
}

export async function clearGeminiChat(): Promise<void> {
  aiHistoryStore.set((prev) => ({ ...prev, messages: [] }));
  aiSessionStore.set((prev) => ({
    ...prev,
    status: "idle",
    activeRequestId: null,
    liveEmotionLabel: null,
    currentHeight: 232,
  }));
  triggerCompanionMood("butler-bow", 1200);
  if (!isNative) return;
  try {
    await invoke("gemini_new_chat");
  } catch {
    // Ignore
  }
}

export async function setGeminiModel(model: string): Promise<void> {
  aiSessionStore.set((prev) => ({ ...prev, model }));
  if (!isNative) return;
  try {
    await invoke("gemini_set_model", { model });
  } catch {
    // Ignore
  }
}
