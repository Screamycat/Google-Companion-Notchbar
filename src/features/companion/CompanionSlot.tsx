import { useEffect, useState } from "react";
import { motion } from "motion/react";
import {
  settings,
  type CompanionCustomization,
  type CompanionShape,
  type CompanionColor,
  type CompanionEyes,
} from "../../settings/store";
import { useNowPlaying } from "../../platform/media";
import type { NotchStatus } from "../../notch/useNotchState";
import type { NotchGeometry } from "../../notch/geometry";

export type CompanionVariant = "peek" | "overview" | "music";

export interface NotchCompanionProps {
  status: NotchStatus;
  activeTab: string;
  size: { w: number; h: number };
  geometry: NotchGeometry;
  line?: boolean;
}

/**
 * Returns shape borderRadius for the companion body
 */
export function getShapeRadius(shape: CompanionShape): string {
  switch (shape) {
    case "squircle":
      return "28%";
    case "pill":
      return "44% 44% 38% 38% / 48% 48% 40% 40%";
    case "egg":
      return "48% 48% 40% 40% / 54% 54% 38% 38%";
    case "circle":
    default:
      return "50%";
  }
}

/**
 * Returns color classes and styles for the companion body and aura
 */
export function getColorStyle(color: CompanionColor) {
  switch (color) {
    case "accent":
      return {
        bodyClass:
          "border-[2px] border-[var(--accent,#4285f4)]/95 bg-gradient-to-b from-[var(--accent,#4285f4)]/[0.32] to-[var(--accent,#4285f4)]/[0.08] shadow-[inset_0_2px_8px_rgb(255_255_255/0.28),0_6px_20px_color-mix(in_srgb,var(--accent,#4285f4)_40%,transparent)]",
        auraBg:
          "radial-gradient(circle at 50% 42%, color-mix(in srgb, var(--accent, #4285f4) 45%, transparent), transparent 72%)",
      };
    case "gemini":
      return {
        bodyClass:
          "border-[2px] border-[#c084fc]/90 bg-gradient-to-br from-[#9b72cb]/[0.35] via-[#4285f4]/[0.2] to-[#2563eb]/[0.1] shadow-[inset_0_2px_10px_rgb(255_255_255/0.3),0_6px_22px_rgb(155_114_203/0.45)]",
        auraBg:
          "radial-gradient(circle at 50% 42%, rgb(155 114 203 / 0.5), transparent 72%)",
      };
    case "dark":
      return {
        bodyClass:
          "border-[2px] border-white/35 bg-gradient-to-b from-white/[0.08] to-black/[0.7] shadow-[inset_0_2px_6px_rgb(255_255_255/0.1),0_6px_18px_rgb(0_0_0/0.8)]",
        auraBg:
          "radial-gradient(circle at 50% 42%, rgb(255 255 255 / 0.12), transparent 72%)",
      };
    case "mint":
      return {
        bodyClass:
          "border-[2px] border-[#34a853]/90 bg-gradient-to-b from-[#34a853]/[0.32] to-[#34a853]/[0.08] shadow-[inset_0_2px_8px_rgb(255_255_255/0.25),0_6px_18px_rgb(52_168_83/0.4)]",
        auraBg:
          "radial-gradient(circle at 50% 42%, rgb(52 168 83 / 0.42), transparent 72%)",
      };
    case "amber":
      return {
        bodyClass:
          "border-[2px] border-[#fbbc05]/90 bg-gradient-to-b from-[#fbbc05]/[0.32] to-[#fbbc05]/[0.08] shadow-[inset_0_2px_8px_rgb(255_255_255/0.25),0_6px_18px_rgb(251_188_5/0.4)]",
        auraBg:
          "radial-gradient(circle at 50% 42%, rgb(251 188 5 / 0.42), transparent 72%)",
      };
    case "coral":
      return {
        bodyClass:
          "border-[2px] border-[#ea4335]/90 bg-gradient-to-b from-[#ea4335]/[0.32] to-[#ea4335]/[0.08] shadow-[inset_0_2px_8px_rgb(255_255_255/0.25),0_6px_18px_rgb(234_67_53/0.4)]",
        auraBg:
          "radial-gradient(circle at 50% 42%, rgb(234 67 53 / 0.42), transparent 72%)",
      };
    case "glass":
    default:
      return {
        bodyClass:
          "border-[2px] border-white/90 bg-gradient-to-b from-white/[0.16] to-white/[0.05] shadow-[inset_0_2px_8px_rgb(255_255_255/0.22),0_6px_18px_rgb(0_0_0/0.45)]",
        auraBg:
          "radial-gradient(circle at 50% 42%, color-mix(in srgb, var(--accent, #4285f4) 28%, transparent), transparent 72%)",
      };
  }
}

/**
 * Persistent living Companion:
 * Always alive, continuous, and single-instance across all states.
 * - Stage 2 (`peek`): Peeking out curiously at the center of the compact island (size 32px)
 * - Stage 3 (`overview`): Centered between the modular left & right widgets (size `companionSize`)
 * - Stage 3 (`music`): Glides to the left side with animated headphones, vibing to playback
 */
export function NotchCompanion({ status, activeTab, size, geometry, line }: NotchCompanionProps) {
  const s = settings.use();
  const { companionSize, morphDuration, openBounce } = s.notch;
  const comp = s.companion;
  const np = useNowPlaying();
  const isPlaying = !!np?.isPlaying;

  const isPeek = status === "peek" && !line;
  const isOpen = status === "open";
  const isOverview = isOpen && activeTab === "overview";
  const isMusic = isOpen && activeTab === "media";

  // Derive variant for expression and accessories
  const variant: CompanionVariant = isMusic ? "music" : isPeek ? "peek" : "overview";

  // Dimensions
  const musicSize = Math.round(companionSize * 0.88);
  const targetSize = isPeek ? 32 : isMusic ? musicSize : companionSize;

  // Vertical center inside content area (between Header 32px and Dock 46px)
  const contentCenterY = (size.h - 14) / 2;
  const targetCenterY = isPeek ? geometry.h / 2 : contentCenterY;

  // Horizontal center offset (0 = center of notch):
  const musicCenterX = -size.w / 2 + 24 + musicSize / 2;
  const targetCenterX = isMusic ? musicCenterX : 0;

  // Exact relative coordinate offsets from left: 50%, top: 0:
  const targetX = Math.round(targetCenterX - targetSize / 2);
  const targetY = Math.round(targetCenterY - targetSize / 2);

  // Visibility
  const isVisible = (isPeek || isOverview || isMusic) && geometry.h > 4;
  const targetScale = isVisible ? 1 : 0.2;
  const targetOpacity = isVisible ? 1 : 0;

  // Cursor tracking & playful wink reaction
  const [look, setLook] = useState({ x: 0, y: 0 });
  const [blink, setBlink] = useState(false);
  const [winking, setWinking] = useState(false);

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      const cx = isMusic ? window.innerWidth / 2 + musicCenterX : window.innerWidth / 2;
      const cy = isPeek ? 24 : contentCenterY;
      const dx = Math.max(-1, Math.min(1, (e.clientX - cx) / 220));
      const dy = Math.max(-1, Math.min(1, (e.clientY - cy) / 160));
      setLook({ x: dx, y: dy });
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => window.removeEventListener("pointermove", onMove);
  }, [isMusic, isPeek, musicCenterX, contentCenterY]);

  useEffect(() => {
    let timeout: number;
    const scheduleBlink = () => {
      const next = 2600 + Math.random() * 2800;
      timeout = window.setTimeout(() => {
        setBlink(true);
        window.setTimeout(() => {
          setBlink(false);
          scheduleBlink();
        }, 130);
      }, next);
    };
    scheduleBlink();
    return () => window.clearTimeout(timeout);
  }, []);

  const eyeOffset = variant === "peek" ? 2.2 : 3.8;
  const pupilX = look.x * eyeOffset;
  const pupilY = (variant === "peek" ? 0.35 : look.y) * eyeOffset;

  const onClickCompanion = (e: React.MouseEvent) => {
    e.stopPropagation();
    setWinking(true);
    window.setTimeout(() => setWinking(false), 380);
  };

  const showHeadphones =
    (comp.accessory === "auto" && (variant === "music" || isPlaying)) || comp.accessory === "headphones";

  const colorStyle = getColorStyle(comp.color);
  const shapeRadius = getShapeRadius(comp.shape);

  return (
    <motion.div
      className="pointer-events-none absolute select-none"
      style={{ left: "50%", top: 0 }}
      animate={{
        x: targetX,
        y: targetY,
        width: targetSize,
        height: targetSize,
        scale: targetScale,
        opacity: targetOpacity,
      }}
      transition={{
        type: "spring",
        visualDuration: morphDuration,
        bounce: Math.max(0.16, openBounce),
      }}
    >
      {/* Soft ambient aura behind the companion */}
      {comp.aura && (
        <motion.div
          className="pointer-events-none absolute inset-0 rounded-full"
          style={{ background: colorStyle.auraBg }}
          animate={{
            scale: isPlaying && variant === "music" ? [1, 1.14, 1] : [1, 1.05, 1],
          }}
          transition={{
            duration: isPlaying && variant === "music" ? 0.9 : 2.8,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />
      )}

      {/* Customizable body with subtle breathing / music nod */}
      <motion.div
        className={`relative flex size-full items-center justify-center ${colorStyle.bodyClass} ${
          isOverview ? "pointer-events-auto cursor-pointer" : ""
        }`}
        style={{ borderRadius: shapeRadius }}
        onClick={isOverview ? onClickCompanion : undefined}
        title={isOverview ? `${comp.name}: Click me!` : undefined}
        animate={
          winking
            ? { scale: [1, 1.12, 0.95, 1], rotate: [0, -6, 6, 0] }
            : isPlaying && (variant === "music" || showHeadphones)
              ? { y: [0, -2.5, 0], rotate: [-2.5, 2.5, -2.5] }
              : variant === "peek"
                ? { y: [0.8, -0.8, 0.8] }
                : { y: [0, -2, 0] }
        }
        transition={{
          duration: winking ? 0.35 : isPlaying && (variant === "music" || showHeadphones) ? 0.85 : 3.2,
          repeat: winking ? 0 : Infinity,
          ease: "easeInOut",
        }}
      >
        {/* Adaptive Headphones (adapts logically to every shape) */}
        {showHeadphones && (
          <HeadphonesOverlay shape={comp.shape} />
        )}

        {/* Alternative Accessories */}
        {!showHeadphones && comp.accessory === "beanie" && <BeanieOverlay />}
        {!showHeadphones && comp.accessory === "halo" && <HaloOverlay />}
        {!showHeadphones && comp.accessory === "crown" && <CrownOverlay />}

        {/* Face SVG: expressive eyes + tiny mouth matching user's reference sketch */}
        <FaceOverlay
          variant={variant}
          eyes={comp.eyes}
          pupilX={pupilX}
          pupilY={pupilY}
          blink={blink}
          winking={winking}
          isPlaying={isPlaying}
          showHeadphones={showHeadphones}
        />
      </motion.div>
    </motion.div>
  );
}

/**
 * Adaptive Headphones Overlay:
 * Positions two outer-edge ear puffs and an arched headband with R=60 curvature,
 * adapting its top contour logically based on the companion's body shape.
 */
function HeadphonesOverlay({ shape }: { shape: CompanionShape }) {
  // Arcs adapted to body shape:
  // Circle: standard concentric circular arc
  // Squircle: cubic bezier conforming flatly over the top edge
  // Pill: taller circular arc
  // Egg: slightly tapered arc
  let headbandD = "M -7 31 A 60 60 0 0 1 107 31";
  let leftPuffX = -13;
  let rightPuffX = 101;
  let puffY = 30;

  if (shape === "squircle") {
    headbandD = "M -7 30 C -7 8, 107 8, 107 30";
    puffY = 30;
  } else if (shape === "pill") {
    headbandD = "M -7 27 A 60 64 0 0 1 107 27";
    puffY = 27;
  } else if (shape === "egg") {
    headbandD = "M -5 29 A 58 60 0 0 1 105 29";
    leftPuffX = -11;
    rightPuffX = 99;
    puffY = 29;
  }

  return (
    <svg
      viewBox="0 0 100 100"
      className="pointer-events-none absolute inset-0 size-full overflow-visible"
      aria-hidden
    >
      {/* Concentric headband floating above the head line */}
      <path
        d={headbandD}
        fill="none"
        stroke="var(--accent, #4285f4)"
        strokeWidth="5"
        strokeLinecap="round"
      />
      {/* Left ear puff on the outer edge of the head */}
      <rect x={leftPuffX} y={puffY} width="12" height="28" rx="6" fill="var(--accent, #4285f4)" />
      {/* Right ear puff on the outer edge of the head */}
      <rect x={rightPuffX} y={puffY} width="12" height="28" rx="6" fill="var(--accent, #4285f4)" />
    </svg>
  );
}

/** Cozy knit beanie accessory */
function BeanieOverlay() {
  return (
    <svg
      viewBox="0 0 100 100"
      className="pointer-events-none absolute inset-0 size-full overflow-visible"
      aria-hidden
    >
      <path d="M 18 20 C 22 -4, 78 -4, 82 20 Z" fill="var(--accent, #4285f4)" />
      <rect x="14" y="18" width="72" height="10" rx="4" fill="var(--accent, #4285f4)" stroke="white" strokeWidth="1.8" />
      <circle cx="50" cy="-3" r="5.5" fill="white" />
    </svg>
  );
}

/** Glowing floating angel halo */
function HaloOverlay() {
  return (
    <svg
      viewBox="0 0 100 100"
      className="pointer-events-none absolute inset-0 size-full overflow-visible"
      aria-hidden
    >
      <ellipse cx="50" cy="-9" rx="28" ry="7" fill="none" stroke="#fbbc05" strokeWidth="4" />
      <ellipse cx="50" cy="-9" rx="28" ry="7" fill="none" stroke="#fff" strokeWidth="1.5" opacity="0.75" />
    </svg>
  );
}

/** Tiny monarch royal crown */
function CrownOverlay() {
  return (
    <svg
      viewBox="0 0 100 100"
      className="pointer-events-none absolute inset-0 size-full overflow-visible"
      aria-hidden
    >
      <path d="M 30 15 L 34 2 L 44 9 L 50 0 L 56 9 L 66 2 L 70 15 Z" fill="#fbbc05" stroke="#ffe082" strokeWidth="2" strokeLinejoin="round" />
      <circle cx="34" cy="2" r="2.2" fill="#ea4335" />
      <circle cx="50" cy="0" r="2.2" fill="#4285f4" />
      <circle cx="66" cy="2" r="2.2" fill="#34a853" />
    </svg>
  );
}

/** Face SVG with eye styles, blinking, pupil tracking, and mouth */
function FaceOverlay({
  variant,
  eyes,
  pupilX,
  pupilY,
  blink,
  winking,
  isPlaying,
  showHeadphones,
}: {
  variant: CompanionVariant;
  eyes: CompanionEyes;
  pupilX: number;
  pupilY: number;
  blink: boolean;
  winking: boolean;
  isPlaying: boolean;
  showHeadphones: boolean;
}) {
  return (
    <svg viewBox="0 0 100 100" className="size-full overflow-visible" aria-label="Companion">
      <g
        style={{
          transform: `translate(${pupilX}px, ${pupilY}px)`,
          transition: "transform 90ms ease-out",
        }}
      >
        {blink || winking ? (
          <>
            <path d="M 27 42 Q 35 46 43 42" fill="none" stroke="white" strokeWidth="4.5" strokeLinecap="round" />
            <path d="M 57 42 Q 65 46 73 42" fill="none" stroke="white" strokeWidth="4.5" strokeLinecap="round" />
          </>
        ) : variant === "peek" ? (
          /* Peek: curious wide eyes */
          <>
            <circle cx="35" cy="43" r="6.2" fill="white" />
            <circle cx="36.8" cy="41.2" r="2" fill="#000" opacity="0.45" />
            <circle cx="65" cy="43" r="6.2" fill="white" />
            <circle cx="66.8" cy="41.2" r="2" fill="#000" opacity="0.45" />
          </>
        ) : eyes === "curious" ? (
          /* Curious wide open eyes */
          <>
            <circle cx="35" cy="43" r="6.5" fill="white" />
            <circle cx="37" cy="41.5" r="2.2" fill="#000" opacity="0.45" />
            <circle cx="65" cy="43" r="6.5" fill="white" />
            <circle cx="67" cy="41.5" r="2.2" fill="#000" opacity="0.45" />
          </>
        ) : eyes === "anime" ? (
          /* Anime sparkling eyes */
          <>
            <ellipse cx="35" cy="43" rx="7" ry="8" fill="white" />
            <circle cx="37.5" cy="40.5" r="3" fill="#000" opacity="0.65" />
            <circle cx="33.5" cy="40" r="2.2" fill="white" />
            <circle cx="37" cy="46" r="1.3" fill="white" />
            <ellipse cx="65" cy="43" rx="7" ry="8" fill="white" />
            <circle cx="67.5" cy="40.5" r="3" fill="#000" opacity="0.65" />
            <circle cx="63.5" cy="40" r="2.2" fill="white" />
            <circle cx="67" cy="46" r="1.3" fill="white" />
          </>
        ) : eyes === "cool" ? (
          /* Futuristic visor / sunglasses */
          <>
            <path d="M 20 39 Q 50 35 80 39 L 78 48 Q 50 45 22 48 Z" fill="#111" stroke="white" strokeWidth="2.4" />
            <path d="M 26 42 L 44 41" stroke="white" strokeWidth="2" strokeLinecap="round" opacity="0.8" />
          </>
        ) : (
          /* Default happy curved arches matching user sketch */
          <>
            <path d="M 26 44 Q 35 32 44 44" fill="none" stroke="white" strokeWidth="4.8" strokeLinecap="round" />
            <path d="M 56 44 Q 65 32 74 44" fill="none" stroke="white" strokeWidth="4.8" strokeLinecap="round" />
          </>
        )}

        {/* Tiny expressive mouth */}
        {variant === "peek" ? (
          <circle cx="50" cy="60" r="2.6" fill="white" opacity="0.9" />
        ) : isPlaying && (variant === "music" || showHeadphones) ? (
          <path d="M 43 59 Q 50 67 57 59" fill="none" stroke="white" strokeWidth="4.2" strokeLinecap="round" />
        ) : (
          <path d="M 44 60 Q 50 65 56 60" fill="none" stroke="white" strokeWidth="4.2" strokeLinecap="round" />
        )}
      </g>
    </svg>
  );
}

/**
 * Interactive Live Preview widget for the Settings page
 */
export function CompanionPreviewCard({
  custom,
  size = 80,
}: {
  custom?: Partial<CompanionCustomization>;
  size?: number;
}) {
  const comp: CompanionCustomization = { ...settings.use().companion, ...(custom ?? {}) };
  const colorStyle = getColorStyle(comp.color);
  const shapeRadius = getShapeRadius(comp.shape);
  const showHeadphones = comp.accessory === "headphones" || comp.accessory === "auto";

  const [look, setLook] = useState({ x: 0, y: 0 });
  const [blink, setBlink] = useState(false);
  const [winking, setWinking] = useState(false);

  useEffect(() => {
    let timeout: number;
    const scheduleBlink = () => {
      const next = 2400 + Math.random() * 2600;
      timeout = window.setTimeout(() => {
        setBlink(true);
        window.setTimeout(() => {
          setBlink(false);
          scheduleBlink();
        }, 130);
      }, next);
    };
    scheduleBlink();
    return () => window.clearTimeout(timeout);
  }, []);

  const onMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const dx = Math.max(-1, Math.min(1, (e.clientX - cx) / 80));
    const dy = Math.max(-1, Math.min(1, (e.clientY - cy) / 60));
    setLook({ x: dx, y: dy });
  };

  const pupilX = look.x * 3.8;
  const pupilY = look.y * 3.8;

  return (
    <div
      onMouseMove={onMouseMove}
      onMouseLeave={() => setLook({ x: 0, y: 0 })}
      onClick={() => {
        setWinking(true);
        setTimeout(() => setWinking(false), 380);
      }}
      className="pressable relative flex h-36 w-full cursor-pointer items-center justify-center overflow-hidden rounded-[16px] bg-fill-1 border border-white/5"
      title="Click to see Gigi react!"
    >
      {/* Background glow */}
      {comp.aura && (
        <div
          className="pointer-events-none absolute inset-0 opacity-70"
          style={{ background: colorStyle.auraBg }}
        />
      )}

      {/* Floating Companion */}
      <motion.div
        style={{ width: size, height: size }}
        className="relative flex items-center justify-center select-none"
        animate={{ y: [0, -3, 0] }}
        transition={{ duration: 2.8, repeat: Infinity, ease: "easeInOut" }}
      >
        <div
          className={`relative flex size-full items-center justify-center ${colorStyle.bodyClass}`}
          style={{ borderRadius: shapeRadius }}
        >
          {showHeadphones && <HeadphonesOverlay shape={comp.shape} />}
          {!showHeadphones && comp.accessory === "beanie" && <BeanieOverlay />}
          {!showHeadphones && comp.accessory === "halo" && <HaloOverlay />}
          {!showHeadphones && comp.accessory === "crown" && <CrownOverlay />}

          <FaceOverlay
            variant="overview"
            eyes={comp.eyes}
            pupilX={pupilX}
            pupilY={pupilY}
            blink={blink}
            winking={winking}
            isPlaying={false}
            showHeadphones={showHeadphones}
          />
        </div>
      </motion.div>

      <span className="absolute bottom-2 text-caption text-label-3">Click to interact</span>
    </div>
  );
}

/**
 * Layout spacer used inside tab views (OverviewView, NowPlayingView)
 * to reserve the exact layout space so surrounding modular widgets
 * remain pixel-perfect while the persistent NotchCompanion sits above them.
 */
export function CompanionSlot({
  variant,
  className = "",
}: {
  variant: "peek" | "overview" | "music";
  className?: string;
}) {
  const { companionSize } = settings.use().notch;
  const size =
    variant === "peek"
      ? 32
      : variant === "music"
        ? Math.round(companionSize * 0.88)
        : companionSize;

  return (
    <div
      aria-hidden
      className={`pointer-events-none flex shrink-0 items-center justify-center select-none ${className}`}
      style={{ width: size, height: size }}
    />
  );
}
