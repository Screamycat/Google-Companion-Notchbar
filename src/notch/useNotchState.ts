import { useCallback, useEffect, useRef, useState } from "react";
import { createStore } from "../lib/store";
import { setPinned } from "../platform/native";
import { settings } from "../settings/store";

export type NotchStatus = "closed" | "peek" | "open";

/*
 * "Hold": while dragging (seeking, drag and drop) the notch stays open and
 * clickable even if the cursor leaves briefly. A counter, so several places
 * can hold at once.
 */
const holds = createStore(0);

export function holdOpen(on: boolean) {
  holds.set((n) => Math.max(0, n + (on ? 1 : -1)));
  setPinned(holds.get() > 0);
}

/*
 * Pin (top right): the notch stays open even when the cursor leaves or another
 * app takes focus. Esc / the shortcut close and unpin it.
 */
export const pinned = createStore(false);

export function togglePin() {
  pinned.set((p) => !p);
}

/**
 * 3-Stage Notch state machine:
 *
 *   Stage 1 (closed / hidden) ──hover──▶ Stage 2 (peek) ──hover held ≥ hoverDelayMs / click──▶ Stage 3 (open)
 *     ▲                                        │                                                     │
 *     └────────────────leave───────────────────┘◀──────────leave (leaveDelayMs) / Esc / click outside
 *
 *   Shortcut: closed ⇄ open directly, no peek and no delay.
 *   While typing, holding or pinned, leaving doesn't close.
 */
export function useNotchState() {
  const [status, setStatusState] = useState<NotchStatus>("closed");
  const statusRef = useRef<NotchStatus>("closed");
  const hovering = useRef(false);
  const timer = useRef<number | undefined>(undefined);

  const setStatus = useCallback((s: NotchStatus) => {
    statusRef.current = s;
    setStatusState(s);
  }, []);

  const later = useCallback(
    (ms: number, s: NotchStatus) => {
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => setStatus(s), ms);
    },
    [setStatus],
  );

  const open = useCallback(() => {
    window.clearTimeout(timer.current);
    setStatus("open");
  }, [setStatus]);

  const close = useCallback(() => {
    window.clearTimeout(timer.current);
    pinned.set(false);
    setStatus("closed");
  }, [setStatus]);

  const dismiss = useCallback(() => {
    if (pinned.get() || holds.get() > 0) return;
    window.clearTimeout(timer.current);
    setStatus("closed");
  }, [setStatus]);

  /** For the shortcut: open/close directly without peek. Returns the new state. */
  const toggle = useCallback((): NotchStatus => {
    if (statusRef.current === "open") {
      close();
      return "closed";
    }
    open();
    return "open";
  }, [open, close]);

  const onPointerEnter = useCallback(() => {
    hovering.current = true;
    window.clearTimeout(timer.current);
    if (statusRef.current === "closed") {
      setStatus("peek");
      const { notch } = settings.get();
      if (notch.openMode === "hover") {
        later(notch.hoverDelayMs, "open");
      }
    }
  }, [setStatus, later]);

  const onPointerLeave = useCallback(() => {
    hovering.current = false;
    window.clearTimeout(timer.current);
    const { notch } = settings.get();
    if (statusRef.current === "peek") setStatus("closed");
    else if (statusRef.current === "open" && mayAutoClose()) later(notch.leaveDelayMs, "closed");
  }, [setStatus, later]);

  // Hold ended and the cursor is outside → handle the missed leave now.
  useEffect(
    () =>
      holds.subscribe(() => {
        if (!hovering.current && statusRef.current === "open" && mayAutoClose()) {
          later(settings.get().notch.leaveDelayMs, "closed");
        }
      }),
    [later],
  );

  // Unpinned and the cursor is outside → close now.
  useEffect(
    () =>
      pinned.subscribe(() => {
        if (!pinned.get() && !hovering.current && statusRef.current === "open" && mayAutoClose()) {
          later(settings.get().notch.leaveDelayMs, "closed");
        }
      }),
    [later],
  );

  // Esc closes directly.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.clearTimeout(timer.current);
    };
  }, [close]);

  return { status, open, close, dismiss, toggle, onPointerEnter, onPointerLeave };
}

function mayAutoClose(): boolean {
  return !pinned.get() && holds.get() === 0 && !isEditing();
}

function isEditing(): boolean {
  const el = document.activeElement;
  return el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement;
}
