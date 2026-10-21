import { useState, useEffect, useRef } from "react";
import { ArrowCounterClockwise, Record, X } from "@phosphor-icons/react";

interface ShortcutRecorderProps {
  value: string; // e.g. "Ctrl+Alt+Space" or "Alt+A" or "off"
  defaultValue?: string;
  onChange: (val: string) => void | Promise<void>;
  disabled?: boolean;
}

export function ShortcutRecorder({
  value,
  defaultValue,
  onChange,
  disabled,
}: ShortcutRecorderProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [activeMods, setActiveMods] = useState<string[]>([]);
  const [errorHint, setErrorHint] = useState<string | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  // Focus button when recording starts
  useEffect(() => {
    if (isRecording) {
      setActiveMods([]);
      setErrorHint(null);
      buttonRef.current?.focus();
    }
  }, [isRecording]);

  // Window-level key listeners while recording to reliably intercept combinations
  useEffect(() => {
    if (!isRecording) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();

      // Escape cancels recording
      if (e.key === "Escape") {
        setIsRecording(false);
        setActiveMods([]);
        setErrorHint(null);
        return;
      }

      // Backspace or Delete with no modifiers clears/disables the shortcut
      if ((e.key === "Backspace" || e.key === "Delete") && !e.ctrlKey && !e.altKey && !e.shiftKey && !e.metaKey) {
        setIsRecording(false);
        setActiveMods([]);
        setErrorHint(null);
        void onChange("off");
        return;
      }

      // Check current modifiers
      const mods: string[] = [];
      if (e.ctrlKey) mods.push("Ctrl");
      if (e.altKey) mods.push("Alt");
      if (e.shiftKey) mods.push("Shift");
      if (e.metaKey) mods.push("Win");

      // If user is just pressing a modifier key, update the preview
      if (["Control", "Alt", "Shift", "Meta"].includes(e.key)) {
        setActiveMods(mods);
        return;
      }

      // User pressed a non-modifier key
      const isFunctionKey = /^F[1-9]|F1[0-2]$/i.test(e.code) || /^F[1-9]|F1[0-2]$/i.test(e.key);

      // Require at least one modifier unless it's a function key (F1-F12)
      if (mods.length === 0 && !isFunctionKey) {
        setErrorHint("Include Ctrl, Alt, Shift, or Win");
        return;
      }

      // Parse the key
      const keyInfo = parseDOMKeyCode(e.code, e.key);
      const allTokens = [...mods, keyInfo.serialized];
      const resultStr = allTokens.join("+");

      setIsRecording(false);
      setActiveMods([]);
      setErrorHint(null);
      void onChange(resultStr);
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const mods: string[] = [];
      if (e.ctrlKey) mods.push("Ctrl");
      if (e.altKey) mods.push("Alt");
      if (e.shiftKey) mods.push("Shift");
      if (e.metaKey) mods.push("Win");
      setActiveMods(mods);
    };

    window.addEventListener("keydown", handleKeyDown, true);
    window.addEventListener("keyup", handleKeyUp, true);

    return () => {
      window.removeEventListener("keydown", handleKeyDown, true);
      window.removeEventListener("keyup", handleKeyUp, true);
    };
  }, [isRecording, onChange]);

  const isOff = !value || value === "off";
  const tokens = isOff ? [] : value.split("+").map(formatTokenDisplay);

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex items-center gap-1.5">
        <button
          ref={buttonRef}
          type="button"
          disabled={disabled}
          onClick={() => setIsRecording((r) => !r)}
          onBlur={() => {
            // Give a short delay in case user clicked reset or clear
            setTimeout(() => setIsRecording(false), 200);
          }}
          className={`group relative flex h-7 min-w-36 items-center justify-center gap-1.5 rounded-lg px-2.5 text-caption font-medium transition-all ${
            isRecording
              ? "bg-fill-3 ring-2 ring-accent text-label animate-pulse"
              : isOff
              ? "bg-fill-2 hover:bg-fill-3 text-label-3 hover:text-label-2"
              : "bg-fill-2 hover:bg-fill-3 text-label"
          } ${disabled ? "opacity-40 cursor-not-allowed" : "cursor-pointer"}`}
        >
          {isRecording ? (
            <div className="flex items-center gap-1 text-accent font-medium">
              <Record size={12} weight="fill" className="animate-spin text-red-500" />
              {activeMods.length > 0 ? (
                <div className="flex items-center gap-1">
                  {activeMods.map((m) => (
                    <kbd key={m} className="rounded bg-fill-2 px-1 py-0.5 font-mono text-[11px] text-label">
                      {m}
                    </kbd>
                  ))}
                  <span className="text-label-3">+ ...</span>
                </div>
              ) : (
                <span>Press keys… (Esc cancels)</span>
              )}
            </div>
          ) : isOff ? (
            <span className="italic">Disabled (Click to record)</span>
          ) : (
            <div className="flex items-center gap-1">
              {tokens.map((token, idx) => (
                <span key={idx} className="flex items-center gap-1">
                  <kbd className="rounded bg-fill-3 px-1.5 py-0.5 font-mono text-[11px] font-semibold text-label shadow-xs">
                    {token}
                  </kbd>
                  {idx < tokens.length - 1 && <span className="text-label-4 text-[10px]">+</span>}
                </span>
              ))}
            </div>
          )}
        </button>

        {!isRecording && !isOff && (
          <button
            type="button"
            title="Disable shortcut"
            onClick={() => void onChange("off")}
            className="flex size-6 items-center justify-center rounded-md text-label-3 hover:bg-fill-2 hover:text-label-2 transition-colors cursor-pointer"
          >
            <X size={12} weight="bold" />
          </button>
        )}

        {!isRecording && defaultValue && value !== defaultValue && (
          <button
            type="button"
            title={`Reset to default (${defaultValue})`}
            onClick={() => void onChange(defaultValue)}
            className="flex size-6 items-center justify-center rounded-md text-label-3 hover:bg-fill-2 hover:text-label-2 transition-colors cursor-pointer"
          >
            <ArrowCounterClockwise size={12} weight="bold" />
          </button>
        )}
      </div>

      {errorHint && (
        <span className="text-[11px] text-amber-500/90 tracking-tight font-medium">
          {errorHint}
        </span>
      )}
    </div>
  );
}

function parseDOMKeyCode(code: string, key: string): { display: string; serialized: string } {
  // Letters: KeyA -> A
  if (code.startsWith("Key") && code.length === 4) {
    const l = code.slice(3).toUpperCase();
    return { display: l, serialized: l };
  }
  // Digits: Digit0 -> 0
  if (code.startsWith("Digit") && code.length === 6) {
    const d = code.slice(5);
    return { display: d, serialized: d };
  }
  // Function keys: F1..F24
  if (/^F\d+$/i.test(code)) {
    return { display: code.toUpperCase(), serialized: code.toUpperCase() };
  }
  // Numpad digits
  if (code.startsWith("Numpad") && code.length === 7 && !isNaN(Number(code.slice(6)))) {
    const n = code.slice(6);
    return { display: `Num ${n}`, serialized: `Numpad${n}` };
  }

  switch (code) {
    case "Space":
      return { display: "Space", serialized: "Space" };
    case "Enter":
      return { display: "Enter", serialized: "Enter" };
    case "Tab":
      return { display: "Tab", serialized: "Tab" };
    case "Backspace":
      return { display: "Backspace", serialized: "Backspace" };
    case "Delete":
      return { display: "Del", serialized: "Delete" };
    case "Insert":
      return { display: "Ins", serialized: "Insert" };
    case "Home":
      return { display: "Home", serialized: "Home" };
    case "End":
      return { display: "End", serialized: "End" };
    case "PageUp":
      return { display: "PgUp", serialized: "PageUp" };
    case "PageDown":
      return { display: "PgDn", serialized: "PageDown" };
    case "ArrowUp":
      return { display: "↑", serialized: "ArrowUp" };
    case "ArrowDown":
      return { display: "↓", serialized: "ArrowDown" };
    case "ArrowLeft":
      return { display: "←", serialized: "ArrowLeft" };
    case "ArrowRight":
      return { display: "→", serialized: "ArrowRight" };
    case "Minus":
      return { display: "-", serialized: "Minus" };
    case "Equal":
      return { display: "=", serialized: "Equal" };
    case "BracketLeft":
      return { display: "[", serialized: "BracketLeft" };
    case "BracketRight":
      return { display: "]", serialized: "BracketRight" };
    case "Backslash":
      return { display: "\\", serialized: "Backslash" };
    case "Semicolon":
      return { display: ";", serialized: "Semicolon" };
    case "Quote":
      return { display: "'", serialized: "Quote" };
    case "Backquote":
      return { display: "`", serialized: "Backquote" };
    case "Comma":
      return { display: ",", serialized: "Comma" };
    case "Period":
      return { display: ".", serialized: "Period" };
    case "Slash":
      return { display: "/", serialized: "Slash" };
    default:
      const cleanKey = key.length === 1 ? key.toUpperCase() : key;
      return { display: cleanKey, serialized: cleanKey };
  }
}

function formatTokenDisplay(token: string): string {
  switch (token.toLowerCase()) {
    case "control":
    case "ctrl":
      return "Ctrl";
    case "alt":
    case "option":
      return "Alt";
    case "shift":
      return "Shift";
    case "super":
    case "win":
    case "windows":
    case "cmd":
    case "command":
      return "Win";
    case "arrowup":
      return "↑";
    case "arrowdown":
      return "↓";
    case "arrowleft":
      return "←";
    case "arrowright":
      return "→";
    default:
      return token;
  }
}
