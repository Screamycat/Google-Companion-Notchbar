import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { PaperPlaneRight, Stop } from "@phosphor-icons/react";
import { keyboardFocus } from "../../platform/native";
import { t } from "../../i18n";

interface ChatInputBarProps {
  onSend: (text: string) => void;
  onStop: () => void;
  isGenerating: boolean;
  disabled?: boolean;
}

export function ChatInputBar({ onSend, onStop, isGenerating, disabled }: ChatInputBarProps) {
  const [value, setValue] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const id = window.setTimeout(() => {
      textareaRef.current?.focus();
    }, 60);
    return () => window.clearTimeout(id);
  }, []);

  const submit = () => {
    const trimmed = value.trim();
    if (!trimmed || isGenerating || disabled) return;
    onSend(trimmed);
    setValue("");
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  };

  return (
    <div className="flex shrink-0 items-end gap-2 rounded-[14px] border border-separator bg-fill-1 px-3 py-1.5 transition-colors focus-within:border-white/20 focus-within:bg-fill-2">
      <textarea
        ref={textareaRef}
        rows={1}
        value={value}
        disabled={disabled}
        onPointerDown={() => keyboardFocus(true)}
        onFocus={() => keyboardFocus(true)}
        onChange={(e) => {
          setValue(e.target.value);
          e.target.style.height = "auto";
          e.target.style.height = `${Math.min(e.target.scrollHeight, 76)}px`;
        }}
        onKeyDown={onKeyDown}
        placeholder={
          disabled
            ? t("Bitte zuerst mit Google anmelden …")
            : t("Frag Gemini etwas …")
        }
        className="max-h-[76px] min-h-[22px] min-w-0 flex-1 resize-none bg-transparent py-0.5 text-footnote leading-[1.4] text-label placeholder:text-label-3 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50 [scrollbar-width:none]"
      />

      {isGenerating ? (
        <button
          type="button"
          onClick={onStop}
          title={t("Stoppen")}
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-red/20 text-red transition-transform hover:scale-105 hover:bg-red/30 active:scale-95"
        >
          <Stop size={13} weight="fill" />
        </button>
      ) : (
        <button
          type="button"
          onClick={submit}
          disabled={!value.trim() || disabled}
          title={t("Senden")}
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-white transition-all hover:scale-105 active:scale-95 disabled:scale-100 disabled:opacity-30"
          style={{
            background: "var(--accent, #4285f4)",
          }}
        >
          <PaperPlaneRight size={13} weight="fill" />
        </button>
      )}
    </div>
  );
}
