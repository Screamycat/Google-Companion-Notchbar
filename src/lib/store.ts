import { useSyncExternalStore } from "react";
import { invoke } from "@tauri-apps/api/core";

export interface Store<T> {
  get(): T;
  set(next: T | ((prev: T) => T)): void;
  subscribe(listener: () => void): () => void;
  use(): T;
}

const isNative = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

export interface StoreOptions<T> {
  persist?: string;
  normalize?: (loaded: T) => T;
}

/**
 * Minimal global store. With `persist` the state is mirrored to localStorage
 * AND saved directly to disk when running in the native Tauri app, guaranteeing
 * settings and appearance survive restarts, reboots, and abrupt exits.
 */
export function createStore<T>(initial: T, options: StoreOptions<T> = {}): Store<T> {
  const key = options.persist && `notch:${options.persist}`;
  let state = initial;
  if (key) {
    try {
      const raw = localStorage.getItem(key);
      if (raw) {
        const parsed = JSON.parse(raw) as T;
        state = options.normalize ? options.normalize(parsed) : parsed;
      }
    } catch {
      // Broken entry → continue with the default.
    }
  }

  const listeners = new Set<() => void>();
  const store: Store<T> = {
    get: () => state,
    set(next) {
      state = typeof next === "function" ? (next as (prev: T) => T)(state) : next;
      if (key) {
        const json = JSON.stringify(state);
        localStorage.setItem(key, json);
        if (isNative && options.persist) {
          void invoke("config_save", { key: options.persist, value: json });
        }
      }
      listeners.forEach((l) => l());
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    use: () => useSyncExternalStore(store.subscribe, store.get),
  };

  // When running in the native desktop app, hydrate from verified disk file
  if (isNative && options.persist) {
    void invoke<string | null>("config_load", { key: options.persist }).then((diskJson) => {
      if (diskJson) {
        try {
          const parsed = JSON.parse(diskJson) as T;
          const merged = options.normalize ? options.normalize(parsed) : parsed;
          state = merged;
          localStorage.setItem(key!, JSON.stringify(merged));
          listeners.forEach((l) => l());
        } catch {
          // Ignore invalid disk JSON
        }
      } else if (key) {
        // First run on native: save current state to disk
        const json = JSON.stringify(state);
        void invoke("config_save", { key: options.persist, value: json });
      }
    });
  }

  return store;
}

