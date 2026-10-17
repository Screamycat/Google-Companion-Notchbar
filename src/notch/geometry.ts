import type { NotchTuning } from "../settings/store";

/*
 * Notch dimensions per state (CSS px = DIPs, scaled with Windows DPI).
 *
 *   w    width of the black body (without ears)
 *   h    height
 *   r    radius of the bottom corners
 *   ear  radius of the outward-curved "ears" at the top edge
 */
export interface NotchGeometry {
  w: number;
  h: number;
  r: number;
  ear: number;
}

/** Header height when open. */
export const HEADER_HEIGHT = 32;

/** Tool bar at the bottom of the open notch. */
export const DOCK_HEIGHT = 46;

/** Padding when open. Inner radii = r − PADDING (concentric). */
export const PADDING = 16;

export const geometry = {
  /** Focus mode "line": a thin strip at the screen edge, just enough to find it again. */
  line: { w: 150, h: 5, r: 2.5, ear: 3 },
  /** Hover on the line: it stays a line, just a touch bigger, then opens straight away. */
  linePeek: { w: 166, h: 7, r: 3.5, ear: 3.5 },
} satisfies Record<string, NotchGeometry>;

/** Open state: size and radii come from the tuning settings or tab size. */
export function openGeometry(w: number, h: number, r = 30, ear = 14): NotchGeometry {
  return {
    w: clamp(Math.round(w), 360, 720, 540),
    h: clamp(Math.round(h), 200, 520, 300),
    r: clamp(Math.round(r), 8, 48, 30),
    ear: clamp(Math.round(ear), 4, 28, 14),
  };
}

/**
 * Computes the 3-stage geometries directly from the live NotchTuning settings:
 * - Stage 1 (`closed`): 0px height (completely invisible) unless `showHintLine` is enabled.
 * - Stage 2 (`peek`): Compact rounded island where the Companion peeks out.
 * - Stage 3 (`open`): Full dropdown menu with configurable corner & ear radii.
 */
export function stageGeometry(notch: NotchTuning, tabSize?: { w: number; h: number }): {
  closed: NotchGeometry;
  peek: NotchGeometry;
  open: NotchGeometry;
} {
  const tw = clamp(Math.round(notch.triggerW), 60, 480, 180);
  const pw = clamp(Math.round(notch.peekW), 90, 380, 164);
  const ph = clamp(Math.round(notch.peekH), 28, 110, 48);
  const ow = tabSize ? tabSize.w : notch.openW;
  const oh = tabSize ? tabSize.h : notch.openH;

  const peekR = Math.min(24, Math.max(12, Math.round(ph * 0.42)));
  const peekEar = Math.min(12, Math.max(6, Math.round(ph * 0.22)));

  return {
    closed: {
      w: tw,
      h: notch.showHintLine ? 4 : 0,
      r: peekR,
      ear: peekEar,
    },
    peek: {
      w: pw,
      h: ph,
      r: peekR,
      ear: peekEar,
    },
    open: openGeometry(ow, oh, notch.cornerRadius, notch.earRadius),
  };
}

/** Idle size bounds for compatibility with parked modules. */
export const IDLE_W = { min: 80, max: 480, step: 2, def: 188 };
export const IDLE_H = { min: 12, max: 72, step: 1, def: 30 };

export function idleGeometry(w: number, h: number): { closed: NotchGeometry; peek: NotchGeometry } {
  const cw = clamp(Math.round(w), IDLE_W.min, IDLE_W.max, IDLE_W.def);
  const ch = clamp(Math.round(h), IDLE_H.min, IDLE_H.max, IDLE_H.def);
  return {
    closed: { w: cw, h: ch, r: 10, ear: 6 },
    peek: { w: cw + 16, h: ch + 4, r: 12, ear: 7 },
  };
}

function clamp(v: number, min: number, max: number, fallback: number): number {
  return Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : fallback;
}

const LIVE_DW = 96;
const GAMING_DW = 248;
const ACTIVITY_MAX_W = 700;

export function liveGeometry(w: number, h: number): NotchGeometry {
  return activityGeometry(w, h, LIVE_DW);
}

export function gamingGeometry(w: number, h: number): NotchGeometry {
  return activityGeometry(w, h, GAMING_DW);
}

function activityGeometry(w: number, h: number, dw: number): NotchGeometry {
  const cw = clamp(Math.round(w), IDLE_W.min, IDLE_W.max, IDLE_W.def);
  const ch = clamp(Math.round(h), IDLE_H.min, IDLE_H.max, IDLE_H.def);
  return {
    w: Math.min(ACTIVITY_MAX_W, cw + dw),
    h: Math.max(30, ch),
    r: 10,
    ear: 6,
  };
}
