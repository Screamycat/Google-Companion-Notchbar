import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { settings } from "../../settings/store";
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
 * Persistent living Companion:
 * Always alive, continuous, and single-instance across all states.
 * - Stage 2 (`peek`): Peeking out curiously at the center of the compact island (size 32px)
 * - Stage 3 (`overview`): Centered between the modular left & right widgets (size `companionSize`)
 * - Stage 3 (`music`): Glides to the left side with animated headphones, vibing to playback
 *
 * Because this component is persistent and rendered directly in NotchShape, it never unmounts,
 * never crossfades, never blurs, and never fades when opening the dropdown. It is 100% crisp,
 * bright, and alive the exact moment the island opens.
 */
export function NotchCompanion({ status, activeTab, size, geometry, line }: NotchCompanionProps) {
  const { companionSize, morphDuration, openBounce } = settings.use().notch;
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

  // Vertical center:
  // In peek: centered vertically in the peek geometry
  // In open: centered vertically in the content area (between Header 32px and Dock 46px)
  const contentCenterY = (size.h - 14) / 2;
  const targetCenterY = isPeek ? geometry.h / 2 : contentCenterY;

  // Horizontal center offset (0 = center of notch):
  // In peek: 0 (center)
  // In overview: 0 (center)
  // In music: left edge is -size.w / 2. Padding px-5 (20px) + pl-1 (4px) = 24px.
  const musicCenterX = -size.w / 2 + 24 + musicSize / 2;
  const targetCenterX = isMusic ? musicCenterX : 0;

  // Exact relative coordinate offsets from left: 50%, top: 0:
  const targetX = Math.round(targetCenterX - targetSize / 2);
  const targetY = Math.round(targetCenterY - targetSize / 2);

  // Visibility: visible in peek, overview, music when island has height
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
      <motion.div
        className="pointer-events-none absolute inset-0 rounded-full"
        style={{
          background:
            "radial-gradient(circle at 50% 42%, color-mix(in srgb, var(--accent, #4285f4) 28%, transparent), transparent 72%)",
        }}
        animate={{
          scale: isPlaying && variant === "music" ? [1, 1.12, 1] : [1, 1.05, 1],
        }}
        transition={{
          duration: isPlaying && variant === "music" ? 0.9 : 2.8,
          repeat: Infinity,
          ease: "easeInOut",
        }}
      />

      {/* Rounded body with subtle breathing / music nod */}
      <motion.div
        className={`relative flex size-full items-center justify-center rounded-full border-[2px] border-white/90 bg-gradient-to-b from-white/[0.16] to-white/[0.05] shadow-[inset_0_2px_8px_rgb(255_255_255/0.22),0_6px_18px_rgb(0_0_0/0.45)] ${
          isOverview ? "pointer-events-auto cursor-pointer" : ""
        }`}
        onClick={isOverview ? onClickCompanion : undefined}
        title={isOverview ? "Hi there!" : undefined}
        animate={
          winking
            ? { scale: [1, 1.12, 0.95, 1], rotate: [0, -6, 6, 0] }
            : isPlaying && variant === "music"
              ? { y: [0, -2.5, 0], rotate: [-2.5, 2.5, -2.5] }
              : variant === "peek"
                ? { y: [0.8, -0.8, 0.8] }
                : { y: [0, -2, 0] }
        }
        transition={{
          duration: winking ? 0.35 : isPlaying && variant === "music" ? 0.85 : 3.2,
          repeat: winking ? 0 : Infinity,
          ease: "easeInOut",
        }}
      >
        {/* Optional headphones: two side puffs on the edge of his head + headband with slightly larger diameter */}
        {variant === "music" && (
          <svg
            viewBox="0 0 100 100"
            className="pointer-events-none absolute inset-0 size-full overflow-visible"
            aria-hidden
          >
            {/* Headband with slightly larger diameter than head, floating neatly above the white head line */}
            <path
              d="M 0 30 A 53 53 0 0 1 100 30"
              fill="none"
              stroke="var(--accent, #4285f4)"
              strokeWidth="4.5"
              strokeLinecap="round"
            />
            {/* Left ear puff centered right on the left edge of his head */}
            <rect x="-5" y="27" width="10" height="26" rx="5" fill="var(--accent, #4285f4)" />
            {/* Right ear puff centered right on the right edge of his head */}
            <rect x="95" y="27" width="10" height="26" rx="5" fill="var(--accent, #4285f4)" />
          </svg>
        )}

        {/* Face SVG: expressive eyes + tiny mouth matching user's reference sketch */}
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
              /* Curious wide eyes when peeking */
              <>
                <circle cx="35" cy="43" r="6.2" fill="white" />
                <circle cx="36.8" cy="41.2" r="2" fill="#000" opacity="0.45" />
                <circle cx="65" cy="43" r="6.2" fill="white" />
                <circle cx="66.8" cy="41.2" r="2" fill="#000" opacity="0.45" />
              </>
            ) : (
              /* Happy curved eyes matching the reference sketch */
              <>
                <path d="M 26 44 Q 35 32 44 44" fill="none" stroke="white" strokeWidth="4.8" strokeLinecap="round" />
                <path d="M 56 44 Q 65 32 74 44" fill="none" stroke="white" strokeWidth="4.8" strokeLinecap="round" />
              </>
            )}

            {/* Tiny expressive mouth */}
            {variant === "peek" ? (
              <circle cx="50" cy="60" r="2.6" fill="white" opacity="0.9" />
            ) : isPlaying && variant === "music" ? (
              <path d="M 43 59 Q 50 67 57 59" fill="none" stroke="white" strokeWidth="4.2" strokeLinecap="round" />
            ) : (
              <path d="M 44 60 Q 50 65 56 60" fill="none" stroke="white" strokeWidth="4.2" strokeLinecap="round" />
            )}
          </g>
        </svg>
      </motion.div>
    </motion.div>
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
