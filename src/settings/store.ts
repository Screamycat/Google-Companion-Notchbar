import { createStore } from "../lib/store";
import type { AlarmDuration, AlarmSound } from "../lib/sound";

export interface NotchTuning {
  /** Hold time in Stage 2 (Peek) before Stage 3 (Open dropdown) triggers (ms). */
  hoverDelayMs: number;
  /** Grace period on mouse leave before closing (ms). */
  leaveDelayMs: number;
  /** Open dropdown automatically after hoverDelayMs, or require click in Peek. */
  openMode: "hover" | "click";

  /** Stage 1: Hidden top-center trigger zone dimensions (CSS px). */
  triggerW: number;
  triggerH: number;
  /** Show a subtle 3px pill line when hidden, or keep 100% invisible. */
  showHintLine: boolean;

  /** Stage 2: Peek island dimensions when cursor enters trigger zone (CSS px). */
  peekW: number;
  peekH: number;

  /** Stage 3: Open dropdown dimensions & shape radii (CSS px). */
  openW: number;
  openH: number;
  cornerRadius: number;
  earRadius: number;

  /** Companion base diameter in the open tabs (CSS px). */
  companionSize: number;

  /** Animation spring physics (visualDuration in seconds, bounce 0..0.5). */
  peekDuration: number;
  peekBounce: number;
  openDuration: number;
  openBounce: number;
  closeDuration: number;
  closeBounce: number;
  morphDuration: number;
}

export const DEFAULT_NOTCH_TUNING: NotchTuning = {
  hoverDelayMs: 320,
  leaveDelayMs: 180,
  openMode: "hover",
  triggerW: 180,
  triggerH: 6,
  showHintLine: false,
  peekW: 164,
  peekH: 48,
  openW: 540,
  openH: 300,
  cornerRadius: 30,
  earRadius: 14,
  companionSize: 78,
  peekDuration: 0.28,
  peekBounce: 0.28,
  openDuration: 0.42,
  openBounce: 0.22,
  closeDuration: 0.3,
  closeBounce: 0.04,
  morphDuration: 0.34,
};

export type CompanionShape =
  | "circle"
  | "squircle"
  | "pill"
  | "egg"
  | "scallop"
  | "jagged-circle"
  | "hexagon"
  | "triangle"
  | "tower"
  | "elongated-rectangle"
  | "slime";
export type CompanionHat = "none" | "beanie" | "crown" | "halo" | "cap";
export type CompanionEyewear = "none" | "glasses" | "shades";
export type CompanionColor = string;
export type CompanionEyes = "happy" | "curious" | "anime" | "cool";
export type CompanionAccessory = "auto" | "headphones" | "beanie" | "halo" | "crown" | "none";

export interface CompanionCustomization {
  name: string;
  shape: CompanionShape;
  /** Custom hex color string or preset tint */
  color: string;
  /** Hat accessory slot */
  hat?: CompanionHat;
  /** Eyewear / face accessory slot */
  eyewear?: CompanionEyewear;
  /** Smart accessories: auto-switches to headphones during music playback */
  smartAccessories?: boolean;
  aura: boolean;
  /** Music energy threshold (0-100) where companion steps up to Level 2 Groove (default 35) */
  grooveThreshold?: number;
  /** Music energy threshold (0-100) where companion steps up to Level 3 Hype Frenzy / Bass Drop (default 65) */
  dropThreshold?: number;
  // Legacy optional fields
  grooveSensitivity?: number;
  dropSensitivity?: number;
  eyes?: CompanionEyes;
  accessory?: CompanionAccessory;
}

export const DEFAULT_COMPANION: CompanionCustomization = {
  name: "Companion",
  shape: "circle",
  color: "#ffffff",
  hat: "none",
  eyewear: "none",
  smartAccessories: true,
  aura: true,
  grooveThreshold: 35,
  dropThreshold: 65,
};

export interface ToolSetting {
  id: string;
  enabled: boolean;
  category?: string;
}

export interface Settings {
  /** Open on hover or only on click (kept synced with notch.openMode). */
  openMode: "hover" | "click";
  hoverDelay: "fast" | "normal" | "patient";
  /** Live tunable parameters for our 3-stage notch & companion. */
  notch: NotchTuning;
  /** Companion appearance, personality, and accessories. */
  companion: CompanionCustomization;
  /** Order = order in the tool bar. Each tool can have a custom dock category. */
  tools: ToolSetting[];
  /** `auto` = detected via IP (again on every start); a picked location stays. */
  weather: { name: string; lat: number; lon: number; auto?: boolean } | null;
  /**
   * Display: always on top or hidden in fullscreen; monitor name (null = primary);
   * `offset` = horizontal offset from the center in CSS px (set by dragging).
   */
  display: {
    visibility: "always" | "hide-fullscreen";
    monitor: string | null;
    offset: number;
    idleStyle: "notch" | "line";
    idleW: number;
    idleH: number;
  };
  /** Gaming mode: FPS + load in the closed notch: off, only in fullscreen, or always. */
  gaming: { mode: "off" | "fullscreen" | "on" };
  /** Dots like on iPhone: mic/camera (green) or screen recording (red) in use. */
  privacyDots: boolean;
  /** Discord call in the notch (local RPC, on = Discord tool enabled). */
  discord: { clientId: string };
  alarm: { sound: AlarmSound; volume: number; duration: AlarmDuration };
  language: "de" | "en";
  /** Temperature and clock format; picked from the Windows region on first start. */
  units: { temp: "c" | "f"; clock: "24" | "12" };
  /** Presentation mode: hides sensitive content while sharing the screen. */
  presentation: { manual: boolean; auto: boolean };
  /** Check for a new version once a day, anonymously (installs only on click). */
  updates: { auto: boolean };
  /** Look of the notch: background effect, colours, shape and material. */
  appearance: {
    effect: AppearanceEffect;
    closedEffect: boolean;
    accent: string;
    resting: string;
    expanded: string;
    corners: "rounded" | "squared";
    material: "glass" | "dark" | "solid";
    cards: "light" | "dark" | "darker";
    glow: "off" | "subtle" | "strong";
    icons: number;
    subtext: number;
  };
}

export type AppearanceEffect = "none" | "visualizer" | "ambient" | "waves" | "aurora" | "holographic" | "topographic" | "synthwave" | "nightsky";

/** Active tool IDs in the clean-slate dock. Must match `src/notch/tabs.ts`. */
export const TOOL_IDS = ["overview", "media"] as const;

const defaults: Settings = {
  openMode: "hover",
  hoverDelay: "normal",
  notch: { ...DEFAULT_NOTCH_TUNING },
  companion: { ...DEFAULT_COMPANION },
  tools: TOOL_IDS.map((id) => ({ id, enabled: true, category: "main" })),
  weather: null,
  display: { visibility: "always", monitor: null, offset: 0, idleStyle: "notch", idleW: 188, idleH: 30 },
  gaming: { mode: "off" },
  privacyDots: false,
  discord: { clientId: "" },
  alarm: { sound: "chime", volume: 0.7, duration: 5 },
  language: "en",
  units: regionUnits(),
  presentation: { manual: false, auto: true },
  updates: { auto: true },
  appearance: {
    effect: "none",
    closedEffect: false,
    accent: "#4285f4",
    resting: "#000000",
    expanded: "#000000",
    corners: "rounded",
    material: "solid",
    cards: "dark",
    glow: "off",
    icons: 1,
    subtext: 1,
  },
};

/** °F and 12 h where the Windows region uses them (US & co.), otherwise °C and 24 h. */
function regionUnits(): Settings["units"] {
  const loc = navigator.language || "en-US";
  let region = "";
  let cycle: string | undefined;
  try {
    region = new Intl.Locale(loc).maximize().region ?? "";
    cycle = new Intl.DateTimeFormat(loc, { hour: "numeric" }).resolvedOptions().hourCycle;
  } catch {
    // Unknown locale → metric, 24 h.
  }
  return {
    temp: ["US", "LR", "MM", "BS", "BZ", "KY", "PW", "FM", "MH"].includes(region) ? "f" : "c",
    clock: cycle === "h12" || cycle === "h11" ? "12" : "24",
  };
}

export const hoverDelayMs: Record<Settings["hoverDelay"], number> = { fast: 90, normal: 220, patient: 480 };

/** No settings saved yet = fresh install (read before the store writes its defaults). */
export const firstRun = (() => {
  try {
    return localStorage.getItem("notch:settings") === null;
  } catch {
    return false;
  }
})();

export function normalizeSettings(s: Settings): Settings {
  const known = new Set<string>(TOOL_IDS);
  const tools: ToolSetting[] = (s.tools ?? [])
    .filter((t) => known.has(t.id))
    .map((t) => ({
      id: t.id,
      enabled: t.enabled ?? true,
      category: t.category ?? "main",
    }));
  for (const id of TOOL_IDS) {
    if (tools.some((t) => t.id === id)) continue;
    if (id === "overview") tools.unshift({ id, enabled: true, category: "main" });
    else tools.push({ id, enabled: true, category: "main" });
  }
  const notch: NotchTuning = { ...DEFAULT_NOTCH_TUNING, ...(s.notch ?? {}) };
  return {
    ...defaults,
    ...s,
    openMode: notch.openMode,
    notch,
    tools,
    display: { ...defaults.display, ...s.display },
    gaming: { ...defaults.gaming, ...s.gaming },
    discord: { ...defaults.discord, ...s.discord },
    alarm: { ...defaults.alarm, ...s.alarm },
    units: { ...defaults.units, ...s.units },
    presentation: { ...defaults.presentation, ...s.presentation },
    updates: { ...defaults.updates, ...s.updates },
    companion: {
      ...DEFAULT_COMPANION,
      ...(s.companion ?? {}),
      grooveThreshold:
        s.companion?.grooveThreshold ??
        (s.companion?.grooveSensitivity ? Math.round(35 / s.companion.grooveSensitivity) : 35),
      dropThreshold:
        s.companion?.dropThreshold ??
        (s.companion?.dropSensitivity ? Math.round(65 / s.companion.dropSensitivity) : 65),
    },
    language: "en",
  };
}

export const settings = createStore<Settings>(defaults, { persist: "settings", normalize: normalizeSettings });

settings.set(normalizeSettings);

export function updateCompanion(patch: Partial<CompanionCustomization>) {
  settings.set((s) => ({
    ...s,
    companion: { ...s.companion, ...patch },
  }));
}

export function updateNotch(patch: Partial<NotchTuning>) {
  settings.set((s) => {
    const notch = { ...s.notch, ...patch };
    return { ...s, openMode: notch.openMode, notch };
  });
}

export function resetNotchTuning() {
  settings.set((s) => ({
    ...s,
    openMode: DEFAULT_NOTCH_TUNING.openMode,
    notch: { ...DEFAULT_NOTCH_TUNING },
  }));
}

export function updateSettings(patch: Partial<Settings> | ((s: Settings) => Partial<Settings>)) {
  settings.set((s) => ({ ...s, ...(typeof patch === "function" ? patch(s) : patch) }));
}
