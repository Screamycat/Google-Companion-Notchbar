import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { createStore } from "../../lib/store";

/** Is the frontend running in the Tauri app (rather than a regular browser)? */
export const isNative = "__TAURI_INTERNALS__" in window;

/** Reports the hit zone in CSS px relative to the window to Rust (click-through). */
export function setHitRect(rect: { x: number; y: number; w: number; h: number }) {
  if (isNative) void invoke("set_hit_rect", { rect });
}

/**
 * Extra hit area unioned into the reported hit rect while set (e.g. the open
 * Bluetooth panel, which hangs below the notch shape). Viewport CSS px,
 * null = none. The panel sets and clears it; Notch.tsx's bridge does the union
 * so the panel counts as notch area for click-through and hover.
 */
export const hitExtra = createStore<{ x: number; y: number; w: number; h: number } | null>(null);

/** Keeps the window clickable even when the cursor is outside (e.g. while typing). */
export function setPinned(pinned: boolean) {
  if (isNative) void invoke("set_pinned", { pinned });
}

/** Cursor over the hit zone; comes from the Rust poll instead of DOM events. */
export function onNativeHover(handler: (inside: boolean) => void): () => void {
  if (!isNative) return () => {};
  const off = listen<boolean>("notch://hover", (e) => handler(e.payload));
  return () => void off.then((f) => f());
}

/** Window lost focus (click into another app). */
export function onNativeBlur(handler: () => void): () => void {
  if (!isNative) return () => {};
  const off = getCurrentWindow().onFocusChanged(({ payload: focused }) => !focused && handler());
  return () => void off.then((f) => f());
}

/** Global shortcut (Ctrl+Alt+Space) was pressed. */
export function onShortcut(handler: () => void): () => void {
  if (!isNative) return () => {};
  const off = listen("notch://shortcut", handler);
  return () => void off.then((f) => f());
}

/** Tray: left click / "Open" (tab = null) or "Settings" (tab = "settings"). */
export function onTrayOpen(handler: (tab: string | null) => void): () => void {
  if (!isNative) return () => {};
  const off = listen<string | null>("notch://open", (e) => handler(e.payload));
  return () => void off.then((f) => f());
}

/**
 * true: the window takes keyboard focus (after opening via shortcut).
 * false: focus goes back to the previous app if we still have it.
 */
export function keyboardFocus(focus: boolean) {
  if (isNative) void invoke("keyboard_focus", { focus });
}

/** WebView2 memory target: low while the notch sits closed, normal otherwise. */
export function setMemoryLow(low: boolean) {
  if (isNative) void invoke("memory_low", { low });
}

