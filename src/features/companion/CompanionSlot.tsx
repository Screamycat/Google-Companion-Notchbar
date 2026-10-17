import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { settings } from "../../settings/store";
import { useNowPlaying } from "../../platform/media";

export type CompanionVariant = "peek" | "overview" | "music";

export const COMPANION_LAYOUT_ID = "companion-slot";

interface CompanionSlotProps {
  variant: CompanionVariant;
  className?: string;
}

/**
 * Shared Companion container (`layoutId="companion-slot"`).
 * Smoothly animates between:
 * - Stage 2 (`peek`): Peeking out curiously inside the compact island
 * - Stage 3 (`overview`): Centered prominently between the left & right widgets
 * - Stage 3 (`music`): Perched on the left side of the Music tab, vibing to playback
 */
export function CompanionSlot({ variant, className = "" }: CompanionSlotProps) {
  const { companionSize, morphDuration, openBounce } = settings.use().notch;
  const np = useNowPlaying();
  const isPlaying = !!np?.isPlaying;

  // Subtle eye-tracking toward the cursor + natural periodic blinking
  const [look, setLook] = useState({ x: 0, y: 0 });
  const [blink, setBlink] = useState(false);

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      const cx = window.innerWidth / 2;
      const cy = variant === "peek" ? 24 : 140;
      const dx = Math.max(-1, Math.min(1, (e.clientX - cx) / 220));
      const dy = Math.max(-1, Math.min(1, (e.clientY - cy) / 160));
      setLook({ x: dx, y: dy });
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => window.removeEventListener("pointermove", onMove);
  }, [variant]);

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

  const size =
    variant === "peek"
      ? 32
      : variant === "music"
        ? Math.round(companionSize * 0.88)
        : companionSize;

  const eyeOffset = variant === "peek" ? 2.2 : 3.8;
  const pupilX = look.x * eyeOffset;
  const pupilY = (variant === "peek" ? 0.35 : look.y) * eyeOffset;

  return (
    <motion.div
      layoutId={COMPANION_LAYOUT_ID}
      transition={{
        type: "spring",
        visualDuration: morphDuration,
        bounce: Math.max(0.16, openBounce),
      }}
      style={{ width: size, height: size }}
      className={`relative flex shrink-0 select-none items-center justify-center ${className}`}
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
        className="relative flex size-full items-center justify-center rounded-full border-[2px] border-white/85 bg-gradient-to-b from-white/[0.14] to-white/[0.04] shadow-[inset_0_2px_8px_rgb(255_255_255/0.18),0_6px_18px_rgb(0_0_0/0.45)]"
        animate={
          isPlaying && variant === "music"
            ? { y: [0, -2.5, 0], rotate: [-2.5, 2.5, -2.5] }
            : variant === "peek"
              ? { y: [1, -1, 1] }
              : { y: [0, -2, 0] }
        }
        transition={{
          duration: isPlaying && variant === "music" ? 0.85 : 3.2,
          repeat: Infinity,
          ease: "easeInOut",
        }}
      >
        {/* Optional headphones arc when in Music tab */}
        {variant === "music" && (
          <svg
            viewBox="0 0 100 100"
            className="pointer-events-none absolute inset-[-6%] size-[112%] overflow-visible"
            aria-hidden
          >
            <path
              d="M 14 52 A 38 38 0 0 1 86 52"
              fill="none"
              stroke="var(--accent, #4285f4)"
              strokeWidth="5.5"
              strokeLinecap="round"
            />
            <rect x="6" y="44" width="10" height="20" rx="5" fill="var(--accent, #4285f4)" />
            <rect x="84" y="44" width="10" height="20" rx="5" fill="var(--accent, #4285f4)" />
          </svg>
        )}

        {/* Face SVG: expressive eyes + tiny mouth matching user's reference sketch */}
        <svg
          viewBox="0 0 100 100"
          className="size-full overflow-visible"
          aria-label="Companion"
        >
          <g
            style={{
              transform: `translate(${pupilX}px, ${pupilY}px)`,
              transition: "transform 90ms ease-out",
            }}
          >
            {blink ? (
              <>
                <path
                  d="M 27 42 Q 35 46 43 42"
                  fill="none"
                  stroke="white"
                  strokeWidth="4.5"
                  strokeLinecap="round"
                />
                <path
                  d="M 57 42 Q 65 46 73 42"
                  fill="none"
                  stroke="white"
                  strokeWidth="4.5"
                  strokeLinecap="round"
                />
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
                <path
                  d="M 26 44 Q 35 32 44 44"
                  fill="none"
                  stroke="white"
                  strokeWidth="4.8"
                  strokeLinecap="round"
                />
                <path
                  d="M 56 44 Q 65 32 74 44"
                  fill="none"
                  stroke="white"
                  strokeWidth="4.8"
                  strokeLinecap="round"
                />
              </>
            )}

            {/* Tiny expressive mouth */}
            {variant === "peek" ? (
              <circle cx="50" cy="60" r="2.6" fill="white" opacity="0.9" />
            ) : isPlaying && variant === "music" ? (
              <path
                d="M 43 59 Q 50 67 57 59"
                fill="none"
                stroke="white"
                strokeWidth="4.2"
                strokeLinecap="round"
              />
            ) : (
              <path
                d="M 44 60 Q 50 65 56 60"
                fill="none"
                stroke="white"
                strokeWidth="4.2"
                strokeLinecap="round"
              />
            )}
          </g>
        </svg>
      </motion.div>
    </motion.div>
  );
}
