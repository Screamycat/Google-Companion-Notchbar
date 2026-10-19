import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { isNative } from "../native";

export type Levels = [number, number, number, number];
type Listener = (levels: Levels) => void;

/*
 * Real levels from the Rust loopback (src-tauri/src/audio.rs).
 * Capture only runs while at least one visible equalizer asks for it.
 */
const listeners = new Set<Listener>();
let unlistenPromise: Promise<() => void> | null = null;
let stopTimer: number | null = null;

export const audioLevelsAvailable = isNative;

export function subscribeLevels(listener: Listener): () => void {
  if (!isNative) return () => {};
  listeners.add(listener);

  if (stopTimer !== null) {
    window.clearTimeout(stopTimer);
    stopTimer = null;
  }

  if (!unlistenPromise) {
    unlistenPromise = listen<Levels>("audio://levels", (e) => {
      listeners.forEach((l) => l(e.payload));
    });
  }
  void invoke("audio_levels", { enabled: true });

  return () => {
    listeners.delete(listener);
    if (listeners.size === 0 && stopTimer === null) {
      stopTimer = window.setTimeout(() => {
        stopTimer = null;
        if (listeners.size === 0) {
          void invoke("audio_levels", { enabled: false });
          const p = unlistenPromise;
          unlistenPromise = null;
          void p?.then((f) => f());
        }
      }, 1000);
    }
  };
}
