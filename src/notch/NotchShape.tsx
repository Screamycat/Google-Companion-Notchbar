import { useEffect, useRef, type ReactNode } from "react";
import { animate, motion, useMotionValue, useTransform, type Transition } from "motion/react";
import type { NotchGeometry } from "./geometry";
import { ShapeWidth } from "./liveEdges";

interface Props {
  geometry: NotchGeometry;
  transition: Transition;
  /** Shadow only when the notch "floats" over content (open). */
  elevated: boolean;
  /**
   * Appearance paint: `solid` colours the ears and the body base, `wash` is the
   * open-panel treatment (translucent colour + backdrop blur, null = solid),
   * `glow` an extra accent halo on the shadow (null = off).
   */
  tone: { solid: string; wash: { color: string; blur: number } | null; glow: string | null };
  children?: ReactNode;
}

/**
 * The black shape: a body with rounded bottom corners + two concave "ears"
 * at the top that blend the notch into the screen edge.
 *
 * All dimensions are motion values animated directly by springs, no React
 * re-render per frame. Animations are interruptible and keep their velocity
 * (important when hovering in and out quickly).
 */
export function NotchShape({ geometry, transition, elevated, tone, children }: Props) {
  const w = useMotionValue(geometry.w);
  const h = useMotionValue(geometry.h);
  const r = useMotionValue(geometry.r);
  const ear = useMotionValue(geometry.ear);
  const shadow = useMotionValue(elevated ? 1 : 0);

  // Ears never exceed body height or poke out when height collapses toward 0
  const effectiveEar = useTransform([ear, h], (values: number[]) => {
    const [e = 0, curH = 0] = values;
    return Math.max(0, Math.min(e, curH));
  });
  const earOffset = useTransform(effectiveEar, (e: number) => -e + 0.5); // 0.5px overlap against hairlines
  const earOpacity = useTransform(effectiveEar, (e: number) => (e > 0.5 ? 1 : 0));

  // The bottom corners must remain rounded throughout the entire closing animation.
  // We guarantee effectiveR preserves the roundness all the way until height reaches 0.
  const effectiveR = useTransform([r, h], (values: number[]) => {
    const [curR = 0, curH = 0] = values;
    if (curH <= 0.5) return 0;
    return Math.max(curR, Math.min(curH * 0.45, 20));
  });

  // Whole device pixels: the shape is centered, so an odd or fractional size puts its edges
  // (and the cover pinned to them) on subpixels that shift every frame, which reads as jitter.
  const wPx = useTransform(w, snap);
  const hPx = useTransform(h, snap);

  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    // Settle to within 0.01 px: the live activity follows the width on subpixels, and
    // Motion's default rest threshold ended every spring with a visible ~0.25 px jump.
    const t = { ...transition, restDelta: 0.01, restSpeed: 0.1 };
    const controls = [animate(w, geometry.w, t), animate(h, geometry.h, t), animate(r, geometry.r, t), animate(ear, geometry.ear, t)];
    return () => controls.forEach((c) => c.stop());
  }, [geometry.w, geometry.h, geometry.r, geometry.ear, transition, w, h, r, ear]);

  useEffect(() => {
    const c = animate(shadow, elevated ? 1 : 0, { duration: 0.3, ease: [0.23, 1, 0.32, 1] });
    return () => c.stop();
  }, [elevated, shadow]);

  return (
    <motion.div className="relative" style={{ width: wPx, height: hPx }}>
      <motion.span
        aria-hidden
        className="absolute top-0 pointer-events-none"
        style={{
          left: earOffset,
          width: effectiveEar,
          height: effectiveEar,
          opacity: earOpacity,
          background: `radial-gradient(circle farthest-side at 0% 100%, transparent calc(100% - 0.75px), ${tone.solid} 100%)`,
        }}
      />
      <motion.span
        aria-hidden
        className="absolute top-0 pointer-events-none"
        style={{
          right: earOffset,
          width: effectiveEar,
          height: effectiveEar,
          opacity: earOpacity,
          background: `radial-gradient(circle farthest-side at 100% 100%, transparent calc(100% - 0.75px), ${tone.solid} 100%)`,
        }}
      />
      <motion.div
        aria-hidden
        className="absolute inset-0"
        style={{
          opacity: shadow,
          borderBottomLeftRadius: effectiveR,
          borderBottomRightRadius: effectiveR,
          boxShadow: `0 18px 40px -10px rgb(0 0 0 / 0.7), 0 4px 12px rgb(0 0 0 / 0.35)${tone.glow ? `, ${tone.glow}` : ""}`,
        }}
      />
      <motion.div
        // clip instead of hidden: no scroll container, so focus/scrollIntoView can't shift the content.
        className="absolute inset-0 overflow-clip bg-notch"
        style={{
          borderBottomLeftRadius: effectiveR,
          borderBottomRightRadius: effectiveR,
          background: tone.wash ? tone.wash.color : tone.solid,
          backdropFilter: tone.wash ? `blur(${tone.wash.blur}px)` : undefined,
        }}
      >
        <ShapeWidth.Provider value={w}>{children}</ShapeWidth.Provider>
      </motion.div>
    </motion.div>
  );
}

/** Nearest size that is an even number of device pixels, so both centered edges land on whole pixels. */
function snap(v: number): number {
  const dpr = window.devicePixelRatio || 1;
  return (Math.round((v * dpr) / 2) * 2) / dpr;
}
