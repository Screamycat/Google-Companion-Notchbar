import { useEffect, useRef, useState } from "react";
import { ArrowSquareOut, CaretDown, Check, GoogleLogo, Sparkle, Trash } from "@phosphor-icons/react";
import { AnimatePresence, motion } from "motion/react";
import { springs } from "../../design/motion";
import { HeaderActions, HeaderButton } from "../../notch/header";
import { CompanionSlot } from "../companion/CompanionSlot";
import { settings } from "../../settings/store";
import { requestSize } from "../../notch/size";
import { t } from "../../i18n";
import {
  aiHistoryStore,
  aiSessionStore,
  clearGeminiChat,
  initGeminiBridge,
  openGeminiWindow,
  sendGeminiMessage,
  setGeminiModel,
  stopGeminiGeneration,
} from "./aiStore";
import { ChatMessageItem } from "./ChatMessageItem";
import { ChatInputBar } from "./ChatInputBar";

export function AiChatView() {
  const { messages } = aiHistoryStore.use();
  const session = aiSessionStore.use();
  const compName = settings.use().companion.name || "Companion";
  const scrollerRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [modelMenuOpen, setModelMenuOpen] = useState(false);

  useEffect(() => {
    void initGeminiBridge();
  }, []);

  // Close model menu when clicking outside
  useEffect(() => {
    if (!modelMenuOpen) return;
    const onDown = (e: PointerEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) {
        setModelMenuOpen(false);
      }
    };
    window.addEventListener("pointerdown", onDown);
    return () => window.removeEventListener("pointerdown", onDown);
  }, [modelMenuOpen]);

  // Auto-scroll to latest message or streaming token
  const lastMsgContent = messages[messages.length - 1]?.content ?? "";
  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [messages.length, lastMsgContent, session.status]);

  // Dynamically expand island height from minimum 232px up to 400px as chat grows
  // Persisted in aiSessionStore so switching tabs and back never resets/cramps the layout
  useEffect(() => {
    if (messages.length === 0) {
      aiSessionStore.set((s) => ({ ...s, currentHeight: 232 }));
      requestSize("ai", { w: 640, h: 232 });
      return;
    }
    const updateHeight = () => {
      const scrollH = scrollerRef.current?.scrollHeight ?? 0;
      const targetH = Math.min(400, Math.max(232, 144 + scrollH));
      aiSessionStore.set((s) => ({ ...s, currentHeight: targetH }));
      requestSize("ai", { w: 640, h: targetH });
    };
    updateHeight();
    const frame = requestAnimationFrame(updateHeight);
    return () => cancelAnimationFrame(frame);
  }, [messages.length, lastMsgContent, session.status]);

  const isGenerating = session.status === "thinking" || session.status === "streaming";
  const moodLabel =
    session.status === "thinking"
      ? t("Denkt nach …")
      : session.liveEmotionLabel || t("Bereit");

  const modelLower = (session.model || "").toLowerCase();
  const isArgon = modelLower.includes("argon");
  const isLite = modelLower.includes("lite");
  const isFlash = !isLite && modelLower.includes("flash");
  const isPro = !isArgon && !isLite && !isFlash;

  return (
    <div className="flex h-full items-center gap-3.5 pl-5 pr-4 pt-1 pb-2">
      <HeaderActions>
        {session.authenticated ? (
          <div className="relative">
            <button
              type="button"
              onClick={() => setModelMenuOpen((v) => !v)}
              title={
                session.account
                  ? `${session.account} · ${t("Klicken, um Modell zu wechseln")}`
                  : t("Klicken, um Modell zu wechseln")
              }
              className="pressable pressable-fill flex h-6 items-center gap-1.5 rounded-full border border-white/[0.08] bg-fill-1 px-2.5 text-[11px] font-medium text-label-2 transition-colors hover:border-white/15 hover:bg-fill-2 hover:text-label"
            >
              <span className="size-1.5 rounded-full bg-green shadow-[0_0_6px_#34d399]" />
              <span className="max-w-[120px] truncate">
                {session.model || "Gemini Pro"}
              </span>
              <CaretDown size={10} weight="bold" className="text-label-3" />
            </button>

            {modelMenuOpen && (
              <div
                ref={menuRef}
                className="absolute right-0 top-7.5 z-50 flex w-52 flex-col gap-0.5 rounded-xl border border-white/20 bg-[#16161b] p-1 text-[11px] shadow-[0_12px_32px_rgba(0,0,0,0.75)] backdrop-blur-2xl"
              >
                {session.account && (
                  <div className="truncate px-2 py-1 text-[10px] font-medium text-label-3 border-b border-white/[0.06]">
                    {session.account}
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => {
                    void setGeminiModel("pro");
                    setModelMenuOpen(false);
                  }}
                  className="flex items-center justify-between rounded-lg px-2 py-1.5 text-left text-label-2 hover:bg-fill-2 hover:text-label transition-colors"
                >
                  <span>Gemini Pro / Advanced</span>
                  {isPro && <Check size={12} weight="bold" className="text-green" />}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    void setGeminiModel("flash");
                    setModelMenuOpen(false);
                  }}
                  className="flex items-center justify-between rounded-lg px-2 py-1.5 text-left text-label-2 hover:bg-fill-2 hover:text-label transition-colors"
                >
                  <span>Gemini Flash</span>
                  {isFlash && <Check size={12} weight="bold" className="text-green" />}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    void setGeminiModel("lite");
                    setModelMenuOpen(false);
                  }}
                  className="flex items-center justify-between rounded-lg px-2 py-1.5 text-left text-label-2 hover:bg-fill-2 hover:text-label transition-colors"
                >
                  <span>Gemini Flash Lite</span>
                  {isLite && <Check size={12} weight="bold" className="text-green" />}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    void setGeminiModel("argon");
                    setModelMenuOpen(false);
                  }}
                  className="flex items-center justify-between rounded-lg px-2 py-1.5 text-left text-label-2 hover:bg-fill-2 hover:text-label transition-colors"
                >
                  <span>Gemini Argon</span>
                  {isArgon && <Check size={12} weight="bold" className="text-green" />}
                </button>
                <div className="my-0.5 border-t border-white/[0.06]" />
                <button
                  type="button"
                  onClick={() => {
                    void openGeminiWindow();
                    setModelMenuOpen(false);
                  }}
                  className="flex items-center justify-between rounded-lg px-2 py-1.5 text-left text-label-3 hover:bg-fill-2 hover:text-label transition-colors"
                >
                  <span>{t("Gemini-Webfenster …")}</span>
                  <ArrowSquareOut size={11} />
                </button>
              </div>
            )}
          </div>
        ) : (
          <button
            type="button"
            onClick={() => void openGeminiWindow()}
            title={t("Mit Google anmelden (Gemini Advanced / Pro)")}
            className="pressable pressable-fill flex h-6 items-center gap-1.5 rounded-full border border-amber-400/25 bg-fill-1 px-2.5 text-[11px] font-medium text-amber-300 transition-colors hover:border-amber-400/50 hover:bg-fill-2"
          >
            <span className="size-1.5 rounded-full bg-amber-400" />
            <span>{t("Google Login")}</span>
            <ArrowSquareOut size={11} weight="bold" />
          </button>
        )}

        {messages.length > 0 && (
          <HeaderButton
            label={t("Chat leeren")}
            onClick={() => void clearGeminiChat()}
          >
            <Trash size={14} weight="bold" />
          </HeaderButton>
        )}
      </HeaderActions>

      {/* Left Column: Persistent Companion Co-Pilot Slot + Live Emotion Badge */}
      <div className="flex shrink-0 flex-col items-center justify-center gap-2">
        <CompanionSlot variant="side" />
        <AnimatePresence mode="wait" initial={false}>
          <motion.span
            key={moodLabel}
            initial={{ opacity: 0, transform: "translateY(2px)" }}
            animate={{ opacity: 1, transform: "translateY(0px)" }}
            exit={{ opacity: 0, transform: "translateY(-2px)" }}
            transition={springs.snappy}
            className="inline-flex items-center gap-1 rounded-full border border-white/[0.08] bg-fill-1 px-2 py-0.5 text-[10px] font-medium text-label-2 shadow-sm"
          >
            <Sparkle
              size={9}
              weight="fill"
              style={{ color: "var(--accent, #4285f4)" }}
            />
            {moodLabel}
          </motion.span>
        </AnimatePresence>
      </div>

      {/* Right Column: Chat History & Input */}
      <div className="flex h-full min-w-0 flex-1 flex-col gap-2">
        <div
          ref={scrollerRef}
          className="flex min-h-0 flex-1 flex-col gap-2.5 overflow-y-auto rounded-[14px] border border-separator bg-black/20 p-3 [scrollbar-width:none]"
        >
          {!session.authenticated && messages.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center gap-2.5 px-4 text-center">
              <div className="flex flex-col items-center gap-1">
                <span className="text-body font-semibold text-label">
                  {t("Mit Google Gemini verbinden")}
                </span>
                <span className="max-w-[320px] text-footnote leading-[1.4] text-label-3">
                  {t("Melde dich einmalig im Gemini-Webfenster mit deinem Google-Konto an, um dein Gemini Pro-Abo direkt in der Notch zu nutzen.")}
                </span>
              </div>
              <button
                type="button"
                onClick={() => void openGeminiWindow()}
                className="flex items-center gap-2 rounded-full px-4 py-1.5 text-footnote font-semibold text-white shadow-md transition-transform hover:scale-[1.02] active:scale-[0.98]"
                style={{ background: "var(--accent, #4285f4)" }}
              >
                <GoogleLogo size={14} weight="bold" />
                <span>{t("Mit Google anmelden")}</span>
              </button>
            </div>
          ) : messages.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center gap-1.5 px-4 text-center">
              <span className="text-body font-semibold text-label">
                {t("Wie kann ich helfen?")}
              </span>
              <span className="text-caption text-label-3">
                {t("{name} reagiert live auf Geminis Antworten", { name: compName })}
              </span>
            </div>
          ) : (
            messages.map((msg, i) => (
              <ChatMessageItem
                key={msg.id}
                message={msg}
                isStreaming={isGenerating && i === messages.length - 1 && msg.role === "assistant"}
              />
            ))
          )}
        </div>

        <ChatInputBar
          onSend={(text) => void sendGeminiMessage(text)}
          onStop={() => void stopGeminiGeneration()}
          isGenerating={isGenerating}
        />
      </div>
    </div>
  );
}
