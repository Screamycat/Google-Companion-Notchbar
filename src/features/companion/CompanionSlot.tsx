import { useClipboard } from "../../platform/clipboard";
import { converterStore } from "../convert/ConvertView";
import { useEffect, useState } from "react";
import { AnimatePresence, motion, type Variants } from "motion/react";
import {
  settings,
  type CompanionCustomization,
  type CompanionShape,
  type CompanionColor,
  type CompanionHat,
  type CompanionEyewear,
} from "../../settings/store";
import { useNowPlaying } from "../../platform/media";
import type { NotchStatus } from "../../notch/useNotchState";
import type { NotchGeometry } from "../../notch/geometry";
import {
  classifyAudio,
  useCompanionBrain,
  type CompanionMood,
  type AudioClassification,
  type DaydreamEmoji,
} from "./companionBrain";

export type { CompanionMood, AudioClassification, DaydreamEmoji };
export { classifyAudio };
export type CompanionVariant = "peek" | "overview" | "music" | "clipboard" | "convert";

export interface NotchCompanionProps {
  status: NotchStatus;
  activeTab: string;
  size: { w: number; h: number };
  geometry: NotchGeometry;
  line?: boolean;
}

/**
 * Returns shape borderRadius for simple container shapes
 */
export function getShapeRadius(shape: CompanionShape): string {
  switch (shape) {
    case "squircle":
      return "28%";
    case "pill":
      return "44% 44% 38% 38% / 48% 48% 40% 40%";
    case "egg":
      return "48% 48% 40% 40% / 54% 54% 38% 38%";
    case "tower":
    case "elongated-rectangle":
      return "22px";
    case "circle":
    default:
      return "50%";
  }
}

/**
 * Returns human-friendly display label for each companion shape
 */
export function getShapeLabel(shape: CompanionShape): string {
  switch (shape) {
    case "scallop":
    case "jagged-circle":
      return "Scallop";
    case "tower":
    case "elongated-rectangle":
      return "Tower";
    case "squircle":
      return "Squircle";
    case "pill":
      return "Capsule";
    case "egg":
      return "Egg";
    case "hexagon":
      return "Hexagon";
    case "triangle":
      return "Triangle";
    case "slime":
      return "Slime";
    case "circle":
    default:
      return "Circle";
  }
}

/**
 * Returns exact SVG vector path for all 9 companion shapes.
 * All shapes are designed with smooth, rounded edges and no sharp vertices.
 */
export function getShapePath(shape: CompanionShape): string {
  switch (shape) {
    case "squircle":
      // Rounded square with rx=26, flat top from 30 to 70 at y=4
      return "M 30 4 L 70 4 C 86 4, 96 14, 96 30 L 96 70 C 96 86, 86 96, 70 96 L 30 96 C 14 96, 4 86, 4 70 L 4 30 C 4 14, 14 4, 30 4 Z";

    case "pill":
      // Smooth vertical pill / capsule
      return "M 50 4 C 74 4, 92 22, 92 50 C 92 78, 74 96, 50 96 C 26 96, 8 78, 8 50 C 8 22, 26 4, 50 4 Z";

    case "egg":
      // Smooth tapered egg (narrower top, wider plump base)
      return "M 50 4 C 30 4, 10 28, 10 58 C 10 82, 28 96, 50 96 C 72 96, 90 82, 90 58 C 90 28, 70 4, 50 4 Z";

    case "scallop":
    case "jagged-circle":
      // Wavy scalloped circle with 8 smooth rounded lobes (zero sharp vertices)
      return "M 42.7 9.4 Q 50.0 4.0 57.3 9.4 Q 64.5 14.9 73.5 16.2 Q 82.5 17.5 83.8 26.5 Q 85.1 35.5 90.6 42.7 Q 96.0 50.0 90.6 57.3 Q 85.1 64.5 83.8 73.5 Q 82.5 82.5 73.5 83.8 Q 64.5 85.1 57.3 90.6 Q 50.0 96.0 42.7 90.6 Q 35.5 85.1 26.5 83.8 Q 17.5 82.5 16.2 73.5 Q 14.9 64.5 9.4 57.3 Q 4.0 50.0 9.4 42.7 Q 14.9 35.5 16.2 26.5 Q 17.5 17.5 26.5 16.2 Q 35.5 14.9 42.7 9.4 Z";

    case "hexagon":
      // Smooth regular hexagon with 6 flat edges and 6 rounded corners (r=9)
      return "M 25.8 14.9 Q 30.0 7.0 39.0 7.0 L 61.0 7.0 Q 70.0 7.0 74.2 14.9 L 88.8 42.1 Q 93.0 50.0 88.8 57.9 L 74.2 85.1 Q 70.0 93.0 61.0 93.0 L 39.0 93.0 Q 30.0 93.0 25.8 85.1 L 11.2 57.9 Q 7.0 50.0 11.2 42.1 Z";

    case "triangle":
      // Smooth equilateral delta triangle with rounded vertices (r=14)
      return "M 43.5 19.4 Q 50.0 7.0 56.5 19.4 L 87.5 78.6 Q 94.0 91.0 80.0 91.0 L 20.0 91.0 Q 6.0 91.0 12.5 78.6 Z";

    case "tower":
    case "elongated-rectangle":
      // Slim elongated tower rectangle with smooth rounded pill corners
      return "M 24 4 L 76 4 C 84 4, 90 10, 90 18 L 90 82 C 90 90, 84 96, 76 96 L 24 96 C 16 96, 10 90, 10 82 L 10 18 C 10 10, 16 4, 24 4 Z";

    case "slime":
      // Terraria slime: broad smooth round dome top and flat resting base with rounded corners
      return "M 24 92 L 76 92 C 88 92, 96 84, 96 70 C 96 38, 76 14, 50 14 C 24 14, 4 38, 4 70 C 4 84, 12 92, 24 92 Z";

    case "circle":
    default:
      // Smooth circle centered at 50,50 with radius 46
      return "M 50 4 A 46 46 0 1 1 49.9 4 Z";
  }
}

/**
 * Returns stroke and gradient stops for vector companion body.
 * Seamlessly supports custom hex colors (#4285f4, #ff5500, etc.) or preset themes.
 */
export function getShapeColor(color: CompanionColor) {
  // Support custom arbitrary hex or rgb colors
  if (color && (color.startsWith("#") || color.startsWith("rgb"))) {
    const isLight = color.toLowerCase() === "#ffffff" || color.toLowerCase() === "#fff";
    const isDark =
      color.toLowerCase() === "#000000" ||
      color.toLowerCase() === "#000" ||
      color.toLowerCase() === "#1e1e24" ||
      color.toLowerCase() === "#101014";

    if (isLight) {
      return {
        strokeColor: "rgba(255, 255, 255, 0.95)",
        stops: [
          { offset: "0%", color: "#ffffff", opacity: 0.35 },
          { offset: "100%", color: "#ffffff", opacity: 0.08 },
        ],
        auraBg:
          "radial-gradient(circle at 50% 42%, rgba(255, 255, 255, 0.32), transparent 72%)",
      };
    }

    if (isDark) {
      return {
        strokeColor: "rgba(255, 255, 255, 0.35)",
        stops: [
          { offset: "0%", color: "#ffffff", opacity: 0.12 },
          { offset: "100%", color: "#000000", opacity: 0.82 },
        ],
        auraBg:
          "radial-gradient(circle at 50% 42%, rgba(255, 255, 255, 0.12), transparent 72%)",
      };
    }

    return {
      strokeColor: color,
      stops: [
        { offset: "0%", color, opacity: 0.44 },
        { offset: "100%", color, opacity: 0.12 },
      ],
      auraBg: `radial-gradient(circle at 50% 42%, color-mix(in srgb, ${color} 45%, transparent), transparent 72%)`,
    };
  }

  switch (color) {
    case "accent":
      return {
        strokeColor: "var(--accent, #4285f4)",
        stops: [
          { offset: "0%", color: "var(--accent, #4285f4)", opacity: 0.38 },
          { offset: "100%", color: "var(--accent, #4285f4)", opacity: 0.1 },
        ],
        auraBg:
          "radial-gradient(circle at 50% 42%, color-mix(in srgb, var(--accent, #4285f4) 45%, transparent), transparent 72%)",
      };
    case "gemini":
      return {
        strokeColor: "#c084fc",
        stops: [
          { offset: "0%", color: "#9b72cb", opacity: 0.45 },
          { offset: "50%", color: "#4285f4", opacity: 0.25 },
          { offset: "100%", color: "#2563eb", opacity: 0.12 },
        ],
        auraBg:
          "radial-gradient(circle at 50% 42%, rgb(155 114 203 / 0.5), transparent 72%)",
      };
    case "dark":
      return {
        strokeColor: "rgba(255, 255, 255, 0.38)",
        stops: [
          { offset: "0%", color: "#ffffff", opacity: 0.12 },
          { offset: "100%", color: "#000000", opacity: 0.8 },
        ],
        auraBg:
          "radial-gradient(circle at 50% 42%, rgb(255 255 255 / 0.12), transparent 72%)",
      };
    case "mint":
      return {
        strokeColor: "#34a853",
        stops: [
          { offset: "0%", color: "#34a853", opacity: 0.38 },
          { offset: "100%", color: "#34a853", opacity: 0.1 },
        ],
        auraBg:
          "radial-gradient(circle at 50% 42%, rgb(52 168 83 / 0.42), transparent 72%)",
      };
    case "amber":
      return {
        strokeColor: "#fbbc05",
        stops: [
          { offset: "0%", color: "#fbbc05", opacity: 0.38 },
          { offset: "100%", color: "#fbbc05", opacity: 0.1 },
        ],
        auraBg:
          "radial-gradient(circle at 50% 42%, rgb(251 188 5 / 0.42), transparent 72%)",
      };
    case "coral":
      return {
        strokeColor: "#ea4335",
        stops: [
          { offset: "0%", color: "#ea4335", opacity: 0.38 },
          { offset: "100%", color: "#ea4335", opacity: 0.1 },
        ],
        auraBg:
          "radial-gradient(circle at 50% 42%, rgb(234 67 53 / 0.42), transparent 72%)",
      };
    case "glass":
    default:
      return {
        strokeColor: "rgba(255, 255, 255, 0.92)",
        stops: [
          { offset: "0%", color: "#ffffff", opacity: 0.22 },
          { offset: "100%", color: "#ffffff", opacity: 0.06 },
        ],
        auraBg:
          "radial-gradient(circle at 50% 42%, color-mix(in srgb, var(--accent, #4285f4) 28%, transparent), transparent 72%)",
      };
  }
}

/**
 * Returns color classes and styles for the companion body and aura
 */
export function getColorStyle(color: CompanionColor) {
  if (color && (color.startsWith("#") || color.startsWith("rgb"))) {
    return {
      bodyClass:
        "border-[2px] bg-gradient-to-b shadow-[inset_0_2px_8px_rgb(255_255_255/0.28)]",
      auraBg: `radial-gradient(circle at 50% 42%, color-mix(in srgb, ${color} 45%, transparent), transparent 72%)`,
    };
  }

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
 * Floating music notes drifting upward during music playback
 */
export function FloatingNotes({ grooveLevel = 1 }: { grooveLevel?: 1 | 2 | 3 }) {
  const isSuper = grooveLevel === 3;
  const isHard = grooveLevel === 2 || isSuper;
  return (
    <div className="pointer-events-none absolute inset-0 overflow-visible z-20">
      <motion.div
        className="absolute -top-3 left-1 text-[13px] font-bold text-[var(--accent,#4285f4)] select-none"
        initial={{ opacity: 0, y: 4, x: 0, scale: 0.6 }}
        animate={{
          opacity: [0, 0.95, 0.8, 0],
          y: [-2, -22, -36],
          x: [-2, -8, -12],
          scale: [0.6, 1.1, 0.9],
          rotate: [-10, -25],
        }}
        transition={{
          duration: isSuper ? 1.1 : isHard ? 1.5 : 2.6,
          repeat: Infinity,
          ease: "easeOut",
          delay: 0,
        }}
      >
        ♪
      </motion.div>
      <motion.div
        className="absolute -top-4 right-1 text-[15px] font-bold text-white select-none drop-shadow-[0_2px_8px_rgba(255,255,255,0.4)]"
        initial={{ opacity: 0, y: 6, x: 0, scale: 0.6 }}
        animate={{
          opacity: [0, 1, 0.85, 0],
          y: [-4, -26, -42],
          x: [2, 10, 14],
          scale: [0.6, 1.2, 0.95],
          rotate: [10, 28],
        }}
        transition={{
          duration: isSuper ? 1.0 : isHard ? 1.4 : 2.4,
          repeat: Infinity,
          ease: "easeOut",
          delay: isSuper ? 0.4 : isHard ? 0.6 : 1.2,
        }}
      >
        ♫
      </motion.div>
      {isHard && (
        <motion.div
          className={`absolute -top-5 left-1/2 -translate-x-1/2 text-[12px] font-bold select-none ${
            isSuper ? "text-amber-400 drop-shadow-[0_0_8px_rgba(251,191,36,0.8)]" : "text-amber-300"
          }`}
          initial={{ opacity: 0, y: 2, scale: 0.5 }}
          animate={{
            opacity: [0, 0.95, 0],
            y: [-2, isSuper ? -36 : -30],
            scale: [0.5, isSuper ? 1.3 : 1.15, 0.8],
            rotate: [0, isSuper ? 25 : 15],
          }}
          transition={{
            duration: isSuper ? 0.9 : 1.3,
            repeat: Infinity,
            ease: "easeOut",
            delay: isSuper ? 0.7 : 0.9,
          }}
        >
          ♩
        </motion.div>
      )}
    </div>
  );
}

/**
 * Thought bubble floating above the companion during idle daydreams
 */
export function DaydreamBubble({ emoji }: { emoji: DaydreamEmoji }) {
  return (
    <motion.div
      className="pointer-events-none absolute -top-12 -right-4 z-30 select-none flex items-center justify-center"
      initial={{ scale: 0, opacity: 0, y: 8 }}
      animate={{ scale: [0, 1.14, 1], opacity: 1, y: 0 }}
      exit={{ scale: 0.3, opacity: 0, y: -6, transition: { duration: 0.2 } }}
      transition={{ type: "spring", stiffness: 420, damping: 22 }}
    >
      {/* Thought trail micro-dots */}
      <div className="absolute -bottom-2 -left-2 size-1.5 rounded-full bg-white/75 shadow-sm" />
      <div className="absolute -bottom-1 -left-0.5 size-2 rounded-full bg-white/85 shadow-sm" />

      {/* Main thought bubble */}
      <div className="flex items-center justify-center rounded-full border border-white/40 bg-white/95 px-2.5 py-1 shadow-[0_4px_16px_rgba(0,0,0,0.35)] backdrop-blur-md">
        <span className="text-[14px] leading-none filter drop-shadow-[0_1px_2px_rgba(0,0,0,0.15)]">
          {emoji}
        </span>
      </div>
    </motion.div>
  );
}

/**
 * Static Framer Motion variants for BMO Companion:
 * - Decouples continuous infinite loops from component re-renders (no jitter on mouse look)
 * - Guarantees smooth spring-damped return to `rotate: 0` whenever an animation ends
 */
export const COMPANION_MOTION_VARIANTS: Variants = {
  smelting: {
    y: [0, -2, 1, -1.5, 0],
    rotate: [-3.5, 3.5, -3.5, 3.5, 0],
    scale: [1, 1.05, 0.98, 1.03, 1],
    x: [0, -1.5, 1.5, -1, 1, 0],
    transition: {
      repeat: Infinity,
      duration: 0.32,
      ease: "easeInOut",
    },
  },
  hungry: {
    y: [0, -2, 0],
    rotate: 0,
    scale: 1.04,
    x: 0,
    transition: {
      repeat: Infinity,
      duration: 2.0,
      ease: "easeInOut",
    },
  },

  happy: {
    y: [0, -2.2, 0],
    rotate: 0,
    scale: 1,
    x: 0,
    transition: {
      y: { repeat: Infinity, duration: 3.2, ease: "easeInOut" },
      rotate: { type: "spring", stiffness: 240, damping: 22 },
      scale: { duration: 0.35, ease: "easeOut" },
      x: { duration: 0.2 },
    },
  },
  peek: {
    y: [0.8, -0.8, 0.8],
    rotate: 0,
    scale: 1,
    x: 0,
    transition: {
      y: { repeat: Infinity, duration: 3.2, ease: "easeInOut" },
      rotate: { type: "spring", stiffness: 240, damping: 22 },
      scale: { duration: 0.35 },
      x: { duration: 0.2 },
    },
  },
  curious: {
    y: [0, -1.8, 0],
    rotate: 0,
    scale: 1.02,
    x: 0,
    transition: {
      y: { repeat: Infinity, duration: 2.8, ease: "easeInOut" },
      rotate: { type: "spring", stiffness: 240, damping: 22 },
      scale: { duration: 0.35, ease: "easeOut" },
      x: { duration: 0.2 },
    },
  },
  "vibing-chill": {
    y: [0, -1.8, 0],
    rotate: [-4.5, 4.5, -4.5],
    scale: 1,
    x: 0,
    transition: {
      y: { repeat: Infinity, duration: 2.8, ease: "easeInOut" },
      rotate: { repeat: Infinity, duration: 2.8, ease: "easeInOut" },
      scale: { duration: 0.35 },
      x: { duration: 0.2 },
    },
  },
  "vibing-hard": {
    y: [0, -3.6, 0, -2, 0],
    rotate: [-3.5, 3.5, -3.5],
    scale: 1,
    x: 0,
    transition: {
      y: { repeat: Infinity, duration: 0.85, ease: "easeInOut" },
      rotate: { repeat: Infinity, duration: 0.85, ease: "easeInOut" },
      scale: { duration: 0.3 },
      x: { duration: 0.2 },
    },
  },
  "vibing-super": {
    y: [0, -5, 1, -3, 0],
    rotate: [-5.5, 5.5, -5.5],
    scale: 1,
    x: 0,
    transition: {
      y: { repeat: Infinity, duration: 0.46, ease: "easeInOut" },
      rotate: { repeat: Infinity, duration: 0.46, ease: "easeInOut" },
      scale: { duration: 0.25 },
      x: { duration: 0.2 },
    },
  },
  studying: {
    y: [0, -1.4, 0],
    rotate: 0,
    scale: 1,
    x: 0,
    transition: {
      y: { repeat: Infinity, duration: 2.4, ease: "easeInOut" },
      rotate: { type: "spring", stiffness: 240, damping: 22 },
      scale: { duration: 0.4 },
      x: { duration: 0.2 },
    },
  },
  listening: {
    y: [0, -1.2, 0],
    rotate: -1.5,
    scale: 1,
    x: 0,
    transition: {
      y: { repeat: Infinity, duration: 3.4, ease: "easeInOut" },
      rotate: { type: "spring", stiffness: 220, damping: 24 },
      scale: { duration: 0.4 },
      x: { duration: 0.2 },
    },
  },
  petting: {
    y: [0, -1.4, 0],
    rotate: 0,
    scale: [1, 1.05, 1],
    x: 0,
    transition: {
      y: { repeat: Infinity, duration: 1.6, ease: "easeInOut" },
      scale: { repeat: Infinity, duration: 1.6, ease: "easeInOut" },
      rotate: { type: "spring", stiffness: 240, damping: 22 },
      x: { duration: 0.2 },
    },
  },
  tickled: {
    y: [0, -2.5, 0, -2.5, 0],
    rotate: [-4.5, 4.5, -4.5, 4.5, 0],
    scale: 1,
    x: 0,
    transition: {
      y: { repeat: Infinity, duration: 0.35, ease: "easeInOut" },
      rotate: { repeat: Infinity, duration: 0.35, ease: "easeInOut" },
      scale: { duration: 0.2 },
      x: { duration: 0.2 },
    },
  },
  winking: {
    y: 0,
    rotate: [0, -6, 6, 0],
    scale: [1, 1.12, 1],
    x: 0,
    transition: {
      duration: 0.38,
      ease: "easeInOut",
      rotate: { type: "spring", stiffness: 240, damping: 22 },
    },
  },
  angry: {
    y: 0,
    rotate: 0,
    scale: 1.06,
    x: [0, -4, 4, -3, 3, 0],
    transition: {
      x: { repeat: Infinity, duration: 0.4, ease: "easeInOut" },
      rotate: { type: "spring", stiffness: 240, damping: 22 },
      scale: { duration: 0.25 },
    },
  },
  sad: {
    y: 2,
    rotate: 0,
    scale: 0.96,
    x: 0,
    transition: {
      rotate: { type: "spring", stiffness: 240, damping: 22 },
      y: { duration: 0.4, ease: "easeOut" },
      scale: { duration: 0.4, ease: "easeOut" },
    },
  },
  yawn: {
    y: [0, -3.5, 0],
    scale: [1, 1.1, 1],
    rotate: 0,
    x: 0,
    transition: {
      duration: 2.0,
      ease: "easeInOut",
      rotate: { type: "spring", stiffness: 240, damping: 22 },
    },
  },
  sneeze: {
    y: [0, 2, -4.5, 0],
    scale: [1, 0.92, 1.08, 1],
    rotate: 0,
    x: 0,
    transition: {
      duration: 0.65,
      ease: "easeInOut",
      rotate: { type: "spring", stiffness: 240, damping: 22 },
    },
  },
  sleepy: {
    y: [0, 1.6, 0],
    scale: [1, 0.97, 1],
    rotate: 0,
    x: 0,
    transition: {
      y: { repeat: Infinity, duration: 4.2, ease: "easeInOut" },
      scale: { repeat: Infinity, duration: 4.2, ease: "easeInOut" },
      rotate: { type: "spring", stiffness: 240, damping: 22 },
      x: { duration: 0.2 },
    },
  },
};

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

  const isPeek = status === "peek" && !line;
  const isOpen = status === "open";
  const isOverview = isOpen && activeTab === "overview";
  const isMusic = isOpen && activeTab === "media";
  const isClipboard = isOpen && activeTab === "clipboard";
  const isConvert = isOpen && activeTab === "convert";

  const clipItems = useClipboard();
  const hasClips = clipItems.length > 0;
  const { filesCount } = converterStore.use();
  const hasFiles = filesCount > 0;

  // Derive variant for layout sizing and positioning
  const variant: CompanionVariant = isMusic
    ? "music"
    : isPeek
      ? "peek"
      : isClipboard
        ? "clipboard"
        : isConvert
          ? "convert"
          : "overview";

  // Dimensions
  const musicSize = Math.round(companionSize * 0.88);
  const sideSize = Math.round(companionSize * 0.72);
  const targetSize = isPeek
    ? 32
    : isMusic
      ? musicSize
      : (isClipboard && hasClips) || (isConvert && hasFiles)
        ? sideSize
        : companionSize;

  // Vertical center inside content area (between Header 32px and Dock 46px)
  const contentCenterY = (size.h - 14) / 2;
  const targetCenterY = isPeek ? geometry.h / 2 : contentCenterY;

  // Horizontal center offset (0 = center of notch):
  const musicCenterX = -size.w / 2 + 24 + musicSize / 2;
  const peekCenterX = -geometry.w / 2 + 24;
  const sideCenterX = -size.w / 2 + 20 + sideSize / 2;
  const targetCenterX = isMusic
    ? musicCenterX
    : isPeek
      ? peekCenterX
      : (isClipboard && hasClips) || (isConvert && hasFiles)
        ? sideCenterX
        : 0;

  // Exact relative coordinate offsets from left: 50%, top: 0:
  const targetX = Math.round(targetCenterX - targetSize / 2);
  const targetY = Math.round(targetCenterY - targetSize / 2);

  // Visibility
  const isVisible = (isPeek || isOverview || isMusic || isClipboard || isConvert) && geometry.h > 4;
  const targetScale = isVisible ? 1 : 0.2;
  const targetOpacity = isVisible ? 1 : 0;

  // Ambient center for natural eye tracking across the screen
  const cx = isMusic
    ? window.innerWidth / 2 + musicCenterX
    : isPeek
      ? window.innerWidth / 2 + peekCenterX
      : (isClipboard && hasClips) || (isConvert && hasFiles)
        ? window.innerWidth / 2 + sideCenterX
        : window.innerWidth / 2;
  const cy = isPeek ? geometry.h / 2 : contentCenterY;

  // Autonomous Tamagotchi Brain
  const brain = useCompanionBrain({
    np,
    isMusicTab: isMusic,
    ambientCenter: { x: cx, y: cy },
  });

  const eyeOffset = variant === "peek" ? 2.2 : 3.8;
  const pupilX = brain.look.x * eyeOffset;
  const pupilY = (variant === "peek" ? 0.35 : brain.look.y) * eyeOffset;

  // Resolve split accessories with smart music support (never forcing glasses on audio)
  const { showHeadphones, activeHat, activeEyewear } = resolveAccessories(
    comp,
    brain.audioInfo,
    variant
  );

  const colorStyle = getColorStyle(comp.color);
  const shapeRadius = getShapeRadius(comp.shape);

  return (
    <motion.div
      className="pointer-events-none absolute select-none"
      style={{ left: "50%", top: 0 }}
      data-companion-container="notch"
      data-companion-name={comp.name || "Companion"}
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
            scale:
              brain.audioInfo.isAudioActive && (variant === "music" || showHeadphones)
                ? brain.audioInfo.grooveLevel === 3
                  ? [1, 1.25, 1]
                  : brain.audioInfo.grooveLevel === 2
                    ? [1, 1.18, 1]
                    : [1, 1.1, 1]
                : [1, 1.05, 1],
          }}
          transition={{
            duration:
              brain.audioInfo.isAudioActive && (variant === "music" || showHeadphones)
                ? brain.audioInfo.grooveLevel === 3
                  ? 0.46
                  : brain.audioInfo.grooveLevel === 2
                    ? 0.85
                    : 2.8
                : 2.8,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />
      )}

      {/* Floating thought bubble (kept in brain, visually hidden for now) */}


      {/* Floating music notes during music playback / vibing */}
      <AnimatePresence>
        {(brain.mood === "vibing-chill" ||
          brain.mood === "vibing-hard" ||
          brain.mood === "vibing-super" ||
          brain.mood === "studying" ||
          (brain.audioInfo.isMusic && !brain.audioInfo.isPodcast)) && (
          <FloatingNotes grooveLevel={brain.audioInfo.grooveLevel} />
        )}
      </AnimatePresence>

      <motion.div
        className={`relative flex size-full items-center justify-center ${
          isOverview && !brain.audioInfo.isMusic ? "pointer-events-auto cursor-pointer" : ""
        }`}
        style={{ borderRadius: shapeRadius }}
        onPointerMove={
          isOverview && !brain.audioInfo.isMusic
            ? (e) => brain.onPointerMove(e, e.currentTarget.getBoundingClientRect())
            : undefined
        }
        onPointerLeave={isOverview && !brain.audioInfo.isMusic ? brain.onPointerLeave : undefined}
        onClick={isOverview && !brain.audioInfo.isMusic ? brain.onClick : undefined}
        variants={COMPANION_MOTION_VARIANTS}
        animate={variant === "peek" && brain.mood === "happy" ? "peek" : brain.mood}
      >
        {/* Vector shape body with gradient, stroke, and gloss */}
        <CompanionBody shape={comp.shape} color={comp.color} />

        {/* Adaptive Headphones (adapts logically to every shape + pulses in Level 2 & Level 3) */}
        {showHeadphones && (
          <HeadphonesOverlay
            shape={comp.shape}
            grooveLevel={brain.audioInfo.grooveLevel}
          />
        )}

        {/* Hats slot: hidden during music when smart accessories equips headphones */}
        {!showHeadphones && activeHat === "beanie" && <BeanieOverlay />}
        {!showHeadphones && activeHat === "halo" && <HaloOverlay />}
        {!showHeadphones && activeHat === "crown" && <CrownOverlay />}
        {!showHeadphones && activeHat === "cap" && <CapOverlay />}

        {/* Eyewear slot: can be worn alongside hats or headphones */}
        {activeEyewear === "glasses" && <GlassesOverlay />}
        {activeEyewear === "shades" && <ShadesOverlay />}

        {/* Autonomous Face SVG: reacts to music, cursor, sleepiness, daydreams, and clicks */}
        <FaceOverlay
          variant={variant}
          shape={comp.shape}
          mood={brain.mood}
          pupilX={pupilX}
          pupilY={pupilY}
          blink={brain.blink}
        />

        {/* Holding Book Overlay: adorable open book in lap during study mode */}
        <AnimatePresence>
          {brain.mood === "studying" && (
            <HoldingBookOverlay color={comp.color} />
          )}
        </AnimatePresence>
      </motion.div>
    </motion.div>
  );
}

/**
 * Resolves active accessories honoring Smart Accessories:
 * - When smart accessories is enabled and music plays, headphones take over the head slot.
 * - Hats are neatly set aside during music playback so they never clash with the headband.
 * - Eyewear is preserved and worn concurrently (never auto-forcing glasses on audio).
 */
export function resolveAccessories(
  comp: CompanionCustomization,
  audio: boolean | AudioClassification,
  variant?: CompanionVariant
) {
  const isSmart = comp.smartAccessories !== false;
  const isMusicTab = variant === "music";

  const audioInfo: AudioClassification =
    typeof audio === "boolean"
      ? {
          isAudioActive: audio,
          isMusic: audio,
          isPodcast: false,
          isLofiStudy: false,
          isChill: false,
          isHardcore: false,
          grooveLevel: 1,
          statusHint: "",
        }
      : audio;

  // Smart headphones triggered during playback (music) or dedicated music tab:
  const showHeadphones =
    (isSmart && (audioInfo.isMusic || isMusicTab)) ||
    comp.accessory === "headphones";

  // When headphones are on, active hat is tucked away so headband doesn't collide:
  const activeHat: CompanionHat = showHeadphones
    ? "none"
    : comp.hat ??
      (comp.accessory && ["beanie", "crown", "halo", "cap"].includes(comp.accessory)
        ? (comp.accessory as CompanionHat)
        : "none");

  // Eyewear: preserves user selection (no unwanted auto-glasses on audio)
  const activeEyewear: CompanionEyewear = comp.eyewear ?? "none";

  return { showHeadphones, activeHat, activeEyewear };
}

/**
 * Vector Companion Body:
 * Renders any of the 9 shapes with vector smoothness, rich gradient fills,
 * crisp stroke borders, and glossy 3D highlight.
 */
export function CompanionBody({
  shape,
  color,
}: {
  shape: CompanionShape;
  color: CompanionColor;
}) {
  const d = getShapePath(shape);
  const colorSpec = getShapeColor(color);
  const safeId = (color || "default").replace(/[^a-zA-Z0-9]/g, "");

  return (
    <svg
      viewBox="0 0 100 100"
      className="pointer-events-none absolute inset-0 size-full overflow-visible"
      aria-hidden
    >
      <defs>
        <linearGradient id={`comp-grad-${safeId}`} x1="0" y1="0" x2="0" y2="1">
          {colorSpec.stops.map((s, idx) => (
            <stop key={idx} offset={s.offset} stopColor={s.color} stopOpacity={s.opacity} />
          ))}
        </linearGradient>
        <linearGradient id="comp-specular-shine" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.32" />
          <stop offset="60%" stopColor="#ffffff" stopOpacity="0.04" />
          <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
        </linearGradient>
      </defs>

      {/* Main vector body with gradient and soft drop shadow */}
      <path
        d={d}
        fill={`url(#comp-grad-${safeId})`}
        stroke={colorSpec.strokeColor}
        strokeWidth="2.5"
        strokeLinejoin="round"
        className="filter drop-shadow-[0_4px_14px_rgba(0,0,0,0.5)]"
      />

      {/* Glossy top specular highlight */}
      <path
        d={d}
        fill="url(#comp-specular-shine)"
        opacity="0.65"
      />
    </svg>
  );
}

/**
 * Adaptive headphone geometry tailored to each companion body shape.
 * Keeps ear puffs resting against the outer sides, and arcs the headband
 * concentric/above each shape's top contour with zero overlap!
 */
export function getHeadphoneConfig(shape: CompanionShape) {
  switch (shape) {
    case "squircle":
      // Headband arches cleanly above the flat top edge (y=4), floating at y=-9. ZERO overlap!
      return {
        headbandD: "M -5 30 C -5 0, 8 -9, 26 -9 L 74 -9 C 92 -9, 105 0, 105 30",
        leftPuffX: -11,
        rightPuffX: 99,
        puffY: 28,
      };

    case "pill":
      return {
        headbandD: "M -4 28 A 54 58 0 0 1 104 28",
        leftPuffX: -10,
        rightPuffX: 98,
        puffY: 26,
      };

    case "egg":
      return {
        headbandD: "M 0 34 C 0 8, 28 -8, 50 -8 C 72 -8, 100 8, 100 34",
        leftPuffX: -6,
        rightPuffX: 94,
        puffY: 32,
      };

    case "scallop":
    case "jagged-circle":
      return {
        headbandD: "M -5 32 C -5 4, 20 -9, 50 -9 C 80 -9, 105 4, 105 32",
        leftPuffX: -11,
        rightPuffX: 99,
        puffY: 30,
      };

    case "hexagon":
      return {
        headbandD: "M -5 32 C -5 8, 18 -9, 50 -9 C 82 -9, 105 8, 105 32",
        leftPuffX: -11,
        rightPuffX: 99,
        puffY: 30,
      };

    case "triangle":
      return {
        // Hugs delta triangle slopes, headband arches over top vertex
        headbandD: "M 16 48 C 14 12, 32 -7, 50 -7 C 68 -7, 86 12, 84 48",
        leftPuffX: 10,
        rightPuffX: 78,
        puffY: 46,
      };

    case "tower":
    case "elongated-rectangle":
      return {
        // Fits slim tower vertical walls, floats over top flat edge
        headbandD: "M 5 28 C 5 2, 16 -9, 36 -9 L 64 -9 C 84 -9, 95 2, 95 28",
        leftPuffX: 0,
        rightPuffX: 88,
        puffY: 26,
      };

    case "slime":
      return {
        // Arches over the Terraria slime round top dome (apex y=14), puffs hug cheeks
        headbandD: "M -1 38 C -1 8, 20 0, 50 0 C 80 0, 101 8, 101 38",
        leftPuffX: -7,
        rightPuffX: 95,
        puffY: 36,
      };

    case "circle":
    default:
      return {
        headbandD: "M -7 31 A 60 60 0 0 1 107 31",
        leftPuffX: -13,
        rightPuffX: 101,
        puffY: 30,
      };
  }
}

/**
 * Adaptive Headphones Overlay:
 * Positions two outer-edge ear puffs and an arched headband,
 * adapting logically based on the companion's body shape.
 * Level 2 adds a rhythmic beat-pulse ring; Level 3 adds intense double pulse rings!
 */
export function HeadphonesOverlay({
  shape,
  grooveLevel = 1,
}: {
  shape: CompanionShape;
  grooveLevel?: 1 | 2 | 3;
}) {
  const cfg = getHeadphoneConfig(shape);
  const isSuper = grooveLevel === 3;
  const isHard = grooveLevel === 2 || isSuper;

  return (
    <svg
      viewBox="0 0 100 100"
      className="pointer-events-none absolute inset-0 size-full overflow-visible"
      aria-hidden
    >
      {/* Concentric headband floating cleanly above the head line */}
      <path
        d={cfg.headbandD}
        fill="none"
        stroke="var(--accent, #4285f4)"
        strokeWidth="5"
        strokeLinecap="round"
      />
      {/* Left ear puff on the outer edge of the head */}
      <rect x={cfg.leftPuffX} y={cfg.puffY} width="12" height="28" rx="6" fill="var(--accent, #4285f4)" />
      {/* Right ear puff on the outer edge of the head */}
      <rect x={cfg.rightPuffX} y={cfg.puffY} width="12" height="28" rx="6" fill="var(--accent, #4285f4)" />

      {/* Level 2 & Level 3 pulse rings */}
      {isHard && (
        <motion.g
          animate={{
            opacity: isSuper ? [0.4, 0.95, 0.4] : [0.3, 0.85, 0.3],
            scale: isSuper ? [1, 1.2, 1] : [1, 1.14, 1],
          }}
          transition={{ duration: isSuper ? 0.44 : 0.85, repeat: Infinity, ease: "easeInOut" }}
          style={{ transformOrigin: "50% 50%" }}
        >
          <rect
            x={cfg.leftPuffX - 2.5}
            y={cfg.puffY - 2.5}
            width="17"
            height="33"
            rx="8.5"
            fill="none"
            stroke="var(--accent, #4285f4)"
            strokeWidth={isSuper ? "2.5" : "2"}
            opacity="0.75"
          />
          <rect
            x={cfg.rightPuffX - 2.5}
            y={cfg.puffY - 2.5}
            width="17"
            height="33"
            rx="8.5"
            fill="none"
            stroke="var(--accent, #4285f4)"
            strokeWidth={isSuper ? "2.5" : "2"}
            opacity="0.75"
          />
          {isSuper && (
            <>
              <rect
                x={cfg.leftPuffX - 5}
                y={cfg.puffY - 5}
                width="22"
                height="38"
                rx="11"
                fill="none"
                stroke="#fbbf24"
                strokeWidth="1.8"
                opacity="0.65"
              />
              <rect
                x={cfg.rightPuffX - 5}
                y={cfg.puffY - 5}
                width="22"
                height="38"
                rx="11"
                fill="none"
                stroke="#fbbf24"
                strokeWidth="1.8"
                opacity="0.65"
              />
            </>
          )}
        </motion.g>
      )}
    </svg>
  );
}

/** Cozy knit beanie accessory */
export function BeanieOverlay() {
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
export function HaloOverlay() {
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
export function CrownOverlay() {
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

/** Cute snapback / baseball cap accessory */
export function CapOverlay() {
  return (
    <svg
      viewBox="0 0 100 100"
      className="pointer-events-none absolute inset-0 size-full overflow-visible"
      aria-hidden
    >
      {/* Cap dome */}
      <path d="M 22 22 C 26 2, 74 2, 78 22 Z" fill="var(--accent, #4285f4)" />
      {/* Cap brim / visor sticking out */}
      <path d="M 18 20 C 10 21, 6 26, 11 30 C 23 34, 43 26, 47 22 Z" fill="#2563eb" />
      {/* Top button */}
      <circle cx="50" cy="4" r="3" fill="#ffffff" />
      {/* Front emblem */}
      <circle cx="50" cy="14" r="3.2" fill="#ffffff" opacity="0.9" />
    </svg>
  );
}

/** Smart wireframe reading glasses */
export function GlassesOverlay() {
  return (
    <svg
      viewBox="0 0 100 100"
      className="pointer-events-none absolute inset-0 size-full overflow-visible"
      aria-hidden
    >
      {/* Left lens frame */}
      <circle cx="35" cy="43" r="10.5" fill="rgba(255, 255, 255, 0.08)" stroke="#ffffff" strokeWidth="2.2" />
      {/* Right lens frame */}
      <circle cx="65" cy="43" r="10.5" fill="rgba(255, 255, 255, 0.08)" stroke="#ffffff" strokeWidth="2.2" />
      {/* Bridge over nose */}
      <path d="M 45.5 43 Q 50 39 54.5 43" fill="none" stroke="#ffffff" strokeWidth="2.2" strokeLinecap="round" />
      {/* Temple pieces */}
      <path d="M 24.5 43 L 13 41" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" />
      <path d="M 75.5 43 L 87 41" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" />
      {/* Lens reflection highlights */}
      <path d="M 31 37 L 36 44" stroke="#ffffff" strokeWidth="1.2" strokeLinecap="round" opacity="0.7" />
      <path d="M 61 37 L 66 44" stroke="#ffffff" strokeWidth="1.2" strokeLinecap="round" opacity="0.7" />
    </svg>
  );
}

/** Cool dark sunglasses / shades */
export function ShadesOverlay() {
  return (
    <svg
      viewBox="0 0 100 100"
      className="pointer-events-none absolute inset-0 size-full overflow-visible"
      aria-hidden
    >
      {/* Left sunglass frame & lens */}
      <path
        d="M 22 36 L 47 38 L 45 50 C 44 54, 29 55, 23 49 Z"
        fill="#121216"
        stroke="#ffffff"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      {/* Right sunglass frame & lens */}
      <path
        d="M 53 38 L 78 36 L 77 49 C 71 55, 56 54, 55 50 Z"
        fill="#121216"
        stroke="#ffffff"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      {/* Center bridge */}
      <path d="M 47 38 L 53 38" stroke="#ffffff" strokeWidth="2.4" strokeLinecap="round" />
      {/* Cool reflection highlights */}
      <path d="M 26 40 L 33 48" stroke="#ffffff" strokeWidth="1.4" opacity="0.8" strokeLinecap="round" />
      <path d="M 57 40 L 64 48" stroke="#ffffff" strokeWidth="1.4" opacity="0.8" strokeLinecap="round" />
    </svg>
  );
}

function getBookColorTheme(color: CompanionColor) {
  const isHex = color && (color.startsWith("#") || color.startsWith("rgb"));

  if (isHex) {
    return {
      coverFill: color,
      strokeColor: color,
      pawFill: color,
      inlayStroke: "rgba(255, 255, 255, 0.4)",
    };
  }

  switch (color) {
    case "accent":
      return {
        coverFill: "var(--accent, #4285f4)",
        strokeColor: "var(--accent, #4285f4)",
        pawFill: "var(--accent, #4285f4)",
        inlayStroke: "rgba(255, 255, 255, 0.45)",
      };
    case "gemini":
      return {
        coverFill: "#8b5cf6",
        strokeColor: "#c084fc",
        pawFill: "#9b72cb",
        inlayStroke: "rgba(255, 255, 255, 0.45)",
      };
    case "amber":
      return {
        coverFill: "#f59e0b",
        strokeColor: "#fbbf24",
        pawFill: "#fbbf24",
        inlayStroke: "rgba(255, 255, 255, 0.45)",
      };
    case "coral":
      return {
        coverFill: "#ef4444",
        strokeColor: "#f87171",
        pawFill: "#f87171",
        inlayStroke: "rgba(255, 255, 255, 0.45)",
      };
    case "mint":
      return {
        coverFill: "#10b981",
        strokeColor: "#34d399",
        pawFill: "#34d399",
        inlayStroke: "rgba(255, 255, 255, 0.45)",
      };
    case "dark":
      return {
        coverFill: "#1e293b",
        strokeColor: "rgba(255, 255, 255, 0.5)",
        pawFill: "#334155",
        inlayStroke: "rgba(255, 255, 255, 0.25)",
      };
    case "glass":
    default:
      return {
        coverFill: "rgba(255, 255, 255, 0.25)",
        strokeColor: "rgba(255, 255, 255, 0.9)",
        pawFill: "#ffffff",
        inlayStroke: "rgba(255, 255, 255, 0.45)",
      };
  }
}

/**
 * Adorable Book Holding Overlay:
 * Renders the back/outer cover of the book held up in BMO's hands during study mode.
 * Styled in the companion's theme color with clean vector minimalism, center spine,
 * pages edge peeking at the top, bookmark ribbon, and cute holding paws.
 */
export function HoldingBookOverlay({ color }: { color?: CompanionColor }) {
  const theme = getBookColorTheme(color || "mint");
  const safeId = (color || "default").replace(/[^a-zA-Z0-9]/g, "");

  return (
    <svg
      viewBox="0 0 100 100"
      className="pointer-events-none absolute inset-0 size-full overflow-visible"
      aria-hidden
    >
      <defs>
        <filter id={`book-shadow-${safeId}`} x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="2.5" stdDeviation="2.2" floodOpacity="0.4" />
        </filter>
        <linearGradient id={`book-cover-grad-${safeId}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={theme.coverFill} stopOpacity="0.95" />
          <stop offset="100%" stopColor={theme.coverFill} stopOpacity="0.75" />
        </linearGradient>
        <linearGradient id="book-specular" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.35" />
          <stop offset="50%" stopColor="#ffffff" stopOpacity="0.05" />
          <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
        </linearGradient>
      </defs>

      <motion.g
        initial={{ y: 8, opacity: 0, scale: 0.88 }}
        animate={{ y: 0, opacity: 1, scale: 1 }}
        exit={{ y: 8, opacity: 0, scale: 0.88 }}
        transition={{ type: "spring", stiffness: 320, damping: 24 }}
        filter={`url(#book-shadow-${safeId})`}
      >
        {/* Top inner pages peeking out from behind the cover */}
        <path
          d="M 50 60 Q 37 57.5 25.5 59.5 L 25.5 62 Q 37 60 50 62.5 Q 63 60 74.5 62 L 74.5 59.5 Q 63 57.5 50 60 Z"
          fill="#f8fafc"
          opacity="0.85"
        />

        {/* Back / Outer Cover of the open book in the companion's theme color */}
        <path
          d="M 50 62 Q 37 59.5 24 61.5 L 24 87.5 Q 37 85.5 50 88.5 Q 63 85.5 76 87.5 L 76 61.5 Q 63 59.5 50 62.5 Z"
          fill={`url(#book-cover-grad-${safeId})`}
          stroke={theme.strokeColor}
          strokeWidth="1.6"
          strokeLinejoin="round"
        />

        {/* Specular glossy shine on the cover */}
        <path
          d="M 50 62 Q 37 59.5 24 61.5 L 24 76 Q 37 74 50 76 Q 63 74 76 76 L 76 61.5 Q 63 59.5 50 62.5 Z"
          fill="url(#book-specular)"
        />

        {/* Center Spine Crease / Binding */}
        <line
          x1="50"
          y1="62"
          x2="50"
          y2="88.5"
          stroke="rgba(0, 0, 0, 0.28)"
          strokeWidth="2.2"
          strokeLinecap="round"
        />
        <line
          x1="50"
          y1="62"
          x2="50"
          y2="88.5"
          stroke="rgba(255, 255, 255, 0.4)"
          strokeWidth="0.8"
          strokeLinecap="round"
        />

        {/* Minimal Embossed Inlay Lines on Left and Right Covers */}
        <path
          d="M 28 65 Q 37 63.5 46 65 L 46 84.5 Q 37 83 28 84.5 Z"
          fill="none"
          stroke={theme.inlayStroke}
          strokeWidth="0.9"
          strokeLinejoin="round"
          opacity="0.75"
        />
        <path
          d="M 54 65 Q 63 63.5 72 65 L 72 84.5 Q 63 83 54 84.5 Z"
          fill="none"
          stroke={theme.inlayStroke}
          strokeWidth="0.9"
          strokeLinejoin="round"
          opacity="0.75"
        />

        {/* Red Satin Bookmark Ribbon trailing from the bottom spine */}
        <path
          d="M 49 88 Q 50 92 51.5 95 L 53.5 93.5 L 55 96 Q 52.5 92 51 88 Z"
          fill="#ef4444"
          filter="drop-shadow(0 1px 1px rgba(0,0,0,0.3))"
        />

        {/* Left Paw holding the left edge of the book */}
        <ellipse
          cx="23.5"
          cy="74.5"
          rx="4.4"
          ry="5.4"
          transform="rotate(-12 23.5 74.5)"
          fill={theme.pawFill}
          stroke={theme.strokeColor}
          strokeWidth="1.4"
        />
        <ellipse
          cx="23.2"
          cy="73"
          rx="2.2"
          ry="2.8"
          transform="rotate(-12 23.2 73)"
          fill="#ffffff"
          opacity="0.4"
        />

        {/* Right Paw holding the right edge of the book */}
        <ellipse
          cx="76.5"
          cy="74.5"
          rx="4.4"
          ry="5.4"
          transform="rotate(12 76.5 74.5)"
          fill={theme.pawFill}
          stroke={theme.strokeColor}
          strokeWidth="1.4"
        />
        <ellipse
          cx="76.8"
          cy="73"
          rx="2.2"
          ry="2.8"
          transform="rotate(12 76.8 73)"
          fill="#ffffff"
          opacity="0.4"
        />
      </motion.g>
    </svg>
  );
}

/**
 * Autonomous Face SVG:
 * Expresses happy, curious, vibing, sleepy, angry, sad, and winking states.
 */
export function FaceOverlay({
  variant,
  shape,
  mood,
  pupilX,
  pupilY,
  blink,
}: {
  variant?: CompanionVariant;
  shape?: CompanionShape;
  mood: CompanionMood;
  pupilX: number;
  pupilY: number;
  blink: boolean;
}) {
  const isTriangle = shape === "triangle";
  const offsetY = isTriangle ? 8 : 0;
  const scale = isTriangle ? 0.74 : 1;
  const isBlinking =
    blink &&
    mood !== "winking" &&
    mood !== "sleepy" &&
    mood !== "angry" &&
    mood !== "petting" &&
    mood !== "tickled" &&
    mood !== "sneeze" &&
    mood !== "studying" &&
    mood !== "vibing-chill" &&
    mood !== "vibing-hard" &&
    mood !== "vibing-super";

  return (
    <svg viewBox="0 0 100 100" className="size-full overflow-visible" aria-label="Companion Face">
      <g
        style={{
          transform: `translate(${pupilX}px, ${pupilY + offsetY}px) scale(${scale})`,
          transformOrigin: "50% 54%",
          transition: "transform 90ms ease-out",
        }}
      >
        {isBlinking ? (
          /* Smooth natural blink arches */
          <>
            <path d="M 27 43 Q 35 47 43 43" fill="none" stroke="white" strokeWidth="4.5" strokeLinecap="round" />
            <path d="M 57 43 Q 65 47 73 43" fill="none" stroke="white" strokeWidth="4.5" strokeLinecap="round" />
            <path d="M 44 60 Q 50 65 56 60" fill="none" stroke="white" strokeWidth="4.2" strokeLinecap="round" />
          </>
        ) : mood === "petting" ? (
          /* Blissful closed eyes, warm purring smile, blush cheeks, and tiny floating heart */
          <>
            <path d="M 26 44 Q 35 32 44 44" fill="none" stroke="white" strokeWidth="4.8" strokeLinecap="round" />
            <path d="M 56 44 Q 65 32 74 44" fill="none" stroke="white" strokeWidth="4.8" strokeLinecap="round" />
            <path d="M 44 59 Q 50 66 56 59" fill="none" stroke="white" strokeWidth="4.2" strokeLinecap="round" />
            <circle cx="27" cy="51" r="5" fill="#ff4d79" opacity="0.75" />
            <circle cx="73" cy="51" r="5" fill="#ff4d79" opacity="0.75" />
            <path d="M 76 33 C 76 30, 79 28, 82 30 C 85 28, 88 30, 88 33 C 88 37, 82 41, 82 41 C 82 41, 76 37, 76 33 Z" fill="#ff4d79" opacity="0.9" />
          </>
        ) : mood === "tickled" ? (
          /* Giggling squint '> <' eyes, open laugh mouth 'D', and blush */
          <>
            <path d="M 26 40 L 42 46" stroke="white" strokeWidth="4.2" strokeLinecap="round" />
            <path d="M 26 46 L 42 40" stroke="white" strokeWidth="4.2" strokeLinecap="round" />
            <path d="M 58 40 L 74 46" stroke="white" strokeWidth="4.2" strokeLinecap="round" />
            <path d="M 58 46 L 74 40" stroke="white" strokeWidth="4.2" strokeLinecap="round" />
            <path d="M 42 57 Q 50 71 58 57 Z" fill="white" />
            <circle cx="27" cy="51" r="4.8" fill="#ff4d79" opacity="0.7" />
            <circle cx="73" cy="51" r="4.8" fill="#ff4d79" opacity="0.7" />
          </>
        ) : mood === "yawn" ? (
          /* Big sleepy stretch yawn with wide oval mouth */
          <>
            <path d="M 27 44 Q 35 48 43 44" fill="none" stroke="white" strokeWidth="4.2" strokeLinecap="round" />
            <path d="M 57 44 Q 65 48 73 44" fill="none" stroke="white" strokeWidth="4.2" strokeLinecap="round" />
            <ellipse cx="50" cy="62" rx="5" ry="6.5" fill="white" />
          </>
        ) : mood === "sneeze" ? (
          /* Scrunched up sneeze with tiny mouth and mist droplet */
          <>
            <path d="M 28 42 L 40 46" stroke="white" strokeWidth="4.2" strokeLinecap="round" />
            <path d="M 28 46 L 40 42" stroke="white" strokeWidth="4.2" strokeLinecap="round" />
            <path d="M 60 42 L 72 46" stroke="white" strokeWidth="4.2" strokeLinecap="round" />
            <path d="M 60 46 L 72 42" stroke="white" strokeWidth="4.2" strokeLinecap="round" />
            <circle cx="50" cy="60" r="2.2" fill="white" />
            <circle cx="58" cy="64" r="1.5" fill="#60a5fa" opacity="0.8" />
          </>
        ) : mood === "listening" ? (
          /* Attentive podcast / audiobook listener: calm focused gaze & thoughtful mouth */
          <>
            <circle cx="35" cy="43" r="5.2" fill="white" />
            <circle cx="65" cy="43" r="5.2" fill="white" />
            <circle cx="50" cy="61" r="2.2" fill="white" opacity="0.9" />
          </>
        ) : mood === "studying" ? (
          /* LOFI Study Mode: Peaceful, happy studious closed curved eyes '^ ^', soft calm smile, and cozy blush */
          <>
            {/* Studious happy curved eyes '^ ^' */}
            <path d="M 27 39 Q 35 31 43 39" fill="none" stroke="white" strokeWidth="4.8" strokeLinecap="round" />
            <path d="M 57 39 Q 65 31 73 39" fill="none" stroke="white" strokeWidth="4.8" strokeLinecap="round" />
            {/* Gentle focused smile */}
            <path d="M 44 52 Q 50 58 56 52" fill="none" stroke="white" strokeWidth="3.6" strokeLinecap="round" />
            {/* Cozy study blush */}
            <circle cx="27" cy="45" r="3.4" fill="#ff7698" opacity="0.5" />
            <circle cx="73" cy="45" r="3.4" fill="#ff7698" opacity="0.5" />
          </>
                ) : mood === "smelting" ? (
          /* Dizzy spinning blender eyes '@ @' and open teeth/grin */
          <>
            <path d="M 28 38 C 34 34, 40 40, 36 44 C 32 48, 28 42, 33 39" fill="none" stroke="white" strokeWidth="3.6" strokeLinecap="round" />
            <path d="M 58 38 C 64 34, 70 40, 66 44 C 62 48, 58 42, 63 39" fill="none" stroke="white" strokeWidth="3.6" strokeLinecap="round" />
            <ellipse cx="50" cy="62" rx="7" ry="5" fill="white" />
          </>
        ) : mood === "hungry" ? (
          /* Wide open hungry mouth 'O' waiting to swallow files with bright eyes */
          <>
            <circle cx="34" cy="40" r="5.8" fill="white" />
            <circle cx="66" cy="40" r="5.8" fill="white" />
            <circle cx="50" cy="62" r="7.5" fill="white" />
          </>
        ) : mood === "vibing-chill" ? (
          /* Level 1 Chill Vibe: Serene closed arches and relaxed content smile */
          <>
            <path d="M 26 43 Q 35 34 44 43" fill="none" stroke="white" strokeWidth="4.8" strokeLinecap="round" />
            <path d="M 56 43 Q 65 34 74 43" fill="none" stroke="white" strokeWidth="4.8" strokeLinecap="round" />
            <path d="M 44 59 Q 50 66 56 59" fill="none" stroke="white" strokeWidth="4.2" strokeLinecap="round" />
          </>
        ) : mood === "vibing-super" ? (
          /* Level 3 Super Hype Bass Drop / Hardstyle: Rocking '> <' eyes, open grinning grin 'D', and hype blush */
          <>
            <path d="M 25 38 L 39 43 L 25 48" fill="none" stroke="white" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M 75 38 L 61 43 L 75 48" fill="none" stroke="white" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M 41 56 Q 50 71 59 56 Z" fill="white" />
            <circle cx="27" cy="52" r="4.8" fill="#ff4d79" opacity="0.8" />
            <circle cx="73" cy="52" r="4.8" fill="#ff4d79" opacity="0.8" />
          </>
        ) : mood === "vibing-hard" ? (
          /* Level 2 Hard Groove: Energized rocking beam, open grin 'D', and hype blush */
          <>
            <path d="M 25 43 Q 35 29 45 43" fill="none" stroke="white" strokeWidth="5.2" strokeLinecap="round" />
            <path d="M 55 43 Q 65 29 75 43" fill="none" stroke="white" strokeWidth="5.2" strokeLinecap="round" />
            <path d="M 42 57 Q 50 69 58 57 Z" fill="white" />
            <circle cx="28" cy="52" r="4.2" fill="#ff4d79" opacity="0.55" />
            <circle cx="72" cy="52" r="4.2" fill="#ff4d79" opacity="0.55" />
          </>
        ) : mood === "winking" ? (
          /* Playful wink on click / poke */
          <>
            <path d="M 27 43 Q 35 48 43 43" fill="none" stroke="white" strokeWidth="4.8" strokeLinecap="round" />
            <path d="M 56 44 Q 65 32 74 44" fill="none" stroke="white" strokeWidth="4.8" strokeLinecap="round" />
            <path d="M 42 59 Q 50 68 58 59" fill="none" stroke="white" strokeWidth="4.2" strokeLinecap="round" />
          </>
        ) : mood === "angry" ? (
          /* Cute fierce angry pout '> <' with furrowed brows */
          <>
            <path d="M 25 32 L 40 37" stroke="white" strokeWidth="3.2" strokeLinecap="round" />
            <path d="M 75 32 L 60 37" stroke="white" strokeWidth="3.2" strokeLinecap="round" />
            <path d="M 27 38 L 40 43 L 27 48" fill="none" stroke="white" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M 73 38 L 60 43 L 73 48" fill="none" stroke="white" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M 44 63 Q 50 57 56 63" fill="none" stroke="white" strokeWidth="3.8" strokeLinecap="round" />
          </>
        ) : mood === "sad" ? (
          /* Soft sad droop after being annoyed */
          <>
            <path d="M 27 36 L 43 33" stroke="white" strokeWidth="2.8" strokeLinecap="round" />
            <path d="M 73 36 L 57 33" stroke="white" strokeWidth="2.8" strokeLinecap="round" />
            <path d="M 28 44 Q 35 48 42 44" fill="none" stroke="white" strokeWidth="4.2" strokeLinecap="round" />
            <path d="M 58 44 Q 65 48 72 44" fill="none" stroke="white" strokeWidth="4.2" strokeLinecap="round" />
            <path d="M 44 64 Q 50 59 56 64" fill="none" stroke="white" strokeWidth="3.8" strokeLinecap="round" />
          </>
        ) : mood === "sleepy" ? (
          /* Sleepy relaxed half-closed eyes with zzz */
          <>
            <path d="M 27 44 Q 35 47 43 44" fill="none" stroke="white" strokeWidth="4.2" strokeLinecap="round" />
            <path d="M 57 44 Q 65 47 73 44" fill="none" stroke="white" strokeWidth="4.2" strokeLinecap="round" />
            <path d="M 46 61 Q 50 63 54 61" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" />
            <text x="75" y="32" fill="white" opacity="0.85" fontSize="12" fontWeight="bold" fontFamily="system-ui, sans-serif">
              z
            </text>
            <text x="83" y="24" fill="white" opacity="0.6" fontSize="9" fontWeight="bold" fontFamily="system-ui, sans-serif">
              z
            </text>
          </>
        ) : mood === "curious" || variant === "peek" ? (
          /* Wide curious eyes tracking the cursor: plain solid filled circles without pupils */
          <>
            <circle cx="35" cy="43" r="6.2" fill="white" />
            <circle cx="65" cy="43" r="6.2" fill="white" />
            <circle cx="50" cy="61" r="2.6" fill="white" opacity="0.95" />
          </>
        ) : mood === "vibing" ? (
          /* Music vibing / jamming groove fallback */
          <>
            <path d="M 26 43 Q 35 34 44 43" fill="none" stroke="white" strokeWidth="4.8" strokeLinecap="round" />
            <path d="M 56 43 Q 65 34 74 43" fill="none" stroke="white" strokeWidth="4.8" strokeLinecap="round" />
            <path d="M 43 58 Q 50 67 57 58" fill="none" stroke="white" strokeWidth="4.2" strokeLinecap="round" />
          </>
        ) : (
          /* Default happy joyful arches matching user sketch */
          <>
            <path d="M 26 44 Q 35 32 44 44" fill="none" stroke="white" strokeWidth="4.8" strokeLinecap="round" />
            <path d="M 56 44 Q 65 32 74 44" fill="none" stroke="white" strokeWidth="4.8" strokeLinecap="round" />
            <path d="M 44 60 Q 50 65 56 60" fill="none" stroke="white" strokeWidth="4.2" strokeLinecap="round" />
          </>
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
  const { showHeadphones, activeHat, activeEyewear } = resolveAccessories(comp, false);

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
          className="relative flex size-full items-center justify-center"
          style={{ borderRadius: shapeRadius }}
        >
          <CompanionBody shape={comp.shape} color={comp.color} />
          {showHeadphones && <HeadphonesOverlay shape={comp.shape} />}
          {!showHeadphones && activeHat === "beanie" && <BeanieOverlay />}
          {!showHeadphones && activeHat === "halo" && <HaloOverlay />}
          {!showHeadphones && activeHat === "crown" && <CrownOverlay />}
          {!showHeadphones && activeHat === "cap" && <CapOverlay />}

          {activeEyewear === "glasses" && <GlassesOverlay />}
          {activeEyewear === "shades" && <ShadesOverlay />}

          <FaceOverlay
            variant="overview"
            shape={comp.shape}
            mood={winking ? "winking" : "happy"}
            pupilX={pupilX}
            pupilY={pupilY}
            blink={blink}
          />
        </div>
      </motion.div>

      <span className="absolute bottom-2 text-caption text-label-3">Click to interact</span>
    </div>
  );
}

/**
 * Dedicated, permanent Interactive Companion Stage for Settings.
 * Always docked and visible in the settings menu so the user can immediately
 * see shape, color, accessories, aura, and autonomous emotional reactions in real time!
 */
export function CompanionStage({
  className = "",
}: {
  className?: string;
}) {
  const comp = settings.use().companion;
  const { companionSize } = settings.use().notch;
  const np = useNowPlaying();

  // Autonomous Tamagotchi Brain inside the Stage
  const brain = useCompanionBrain({ np });

  const pupilX = brain.look.x * 3.8;
  const pupilY = brain.look.y * 3.8;

  // Resolve accessories with smart music/podcast support
  const { showHeadphones, activeHat, activeEyewear } = resolveAccessories(comp, brain.audioInfo);

  const colorStyle = getColorStyle(comp.color);
  const shapeRadius = getShapeRadius(comp.shape);
  const displaySize = Math.max(68, Math.min(84, companionSize));

  // Dynamic status hint reflecting BMO's inner state
  const hintText =
    brain.mood === "petting"
      ? "Purring… ♡"
      : brain.mood === "tickled"
        ? "Hehehe ticklish! XD"
        : brain.mood === "yawn"
          ? "Big stretch~"
          : brain.mood === "sneeze"
            ? "Achoo!"
            : brain.mood === "angry"
              ? "Hmph! > <"
              : brain.mood === "sad"
                ? "Aw…"
                : brain.mood === "vibing-super"
                  ? "Bass drop! ⚡"
                  : brain.mood === "vibing-hard"
                    ? "Hard vibing! ♫"
                    : brain.mood === "studying"
                      ? "Studying to lofi 📖"
                      : brain.mood === "vibing-chill"
                        ? "Swaying to the music ♪"
                        : brain.mood === "listening"
                          ? "Listening to podcast…"
                          : brain.mood === "sleepy"
                            ? "Sleeping… zzz"
                            : "Click or stroke to pet!";

  return (
    <div
      onPointerMove={(e) => brain.onPointerMove(e, e.currentTarget.getBoundingClientRect())}
      onPointerLeave={brain.onPointerLeave}
      onClick={brain.onClick}
      className={`group relative flex h-full w-[138px] shrink-0 cursor-pointer flex-col items-center justify-between overflow-hidden rounded-[14px] border border-white/10 bg-fill-1/70 p-3 select-none backdrop-blur-md transition-colors hover:border-white/20 hover:bg-fill-2/80 ${className}`}
    >
      {/* Ambient background aura glow */}
      {comp.aura && (
        <motion.div
          className="pointer-events-none absolute inset-0 opacity-75"
          style={{ background: colorStyle.auraBg }}
          animate={{
            scale:
              brain.audioInfo.isAudioActive && showHeadphones
                ? brain.audioInfo.grooveLevel === 3
                  ? [1, 1.25, 1]
                  : brain.audioInfo.grooveLevel === 2
                    ? [1, 1.18, 1]
                    : [1, 1.1, 1]
                : [1, 1.06, 1],
          }}
          transition={{
            duration:
              brain.audioInfo.isAudioActive && showHeadphones
                ? brain.audioInfo.grooveLevel === 3
                  ? 0.46
                  : brain.audioInfo.grooveLevel === 2
                    ? 0.85
                    : 2.8
                : 2.8,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />
      )}

      {/* Top shape badge */}
      <div className="relative z-10 flex w-full items-center justify-center">
        <span className="rounded-full bg-white/6 px-2.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-label-3">
          {getShapeLabel(comp.shape)}
        </span>
      </div>

      {/* Center Floating Companion with breathe & react animations */}
      <div className="relative my-auto flex items-center justify-center">
        {/* Floating thought bubble (kept in brain, visually hidden for now) */}

        {/* Floating notes in stage */}
        <AnimatePresence>
          {(brain.mood === "vibing-chill" ||
            brain.mood === "vibing-hard" ||
            brain.mood === "vibing-super" ||
            brain.mood === "studying" ||
            (brain.audioInfo.isMusic && !brain.audioInfo.isPodcast)) && (
            <FloatingNotes grooveLevel={brain.audioInfo.grooveLevel} />
          )}
        </AnimatePresence>

        <motion.div
          style={{ width: displaySize, height: displaySize }}
          className="relative flex items-center justify-center"
          variants={COMPANION_MOTION_VARIANTS}
          animate={brain.mood}
        >
          <div
            className="relative flex size-full items-center justify-center"
            style={{ borderRadius: shapeRadius }}
          >
            {/* Vector shape body with gradient, stroke, and gloss */}
            <CompanionBody shape={comp.shape} color={comp.color} />

            {/* Adaptive Headphones */}
            {showHeadphones && (
              <HeadphonesOverlay
                shape={comp.shape}
                grooveLevel={brain.audioInfo.grooveLevel}
              />
            )}

            {/* Hats Slot */}
            {!showHeadphones && activeHat === "beanie" && <BeanieOverlay />}
            {!showHeadphones && activeHat === "halo" && <HaloOverlay />}
            {!showHeadphones && activeHat === "crown" && <CrownOverlay />}
            {!showHeadphones && activeHat === "cap" && <CapOverlay />}

            {/* Eyewear Slot */}
            {activeEyewear === "glasses" && <GlassesOverlay />}
            {activeEyewear === "shades" && <ShadesOverlay />}

            {/* Autonomous Face SVG */}
            <FaceOverlay
              variant="overview"
              shape={comp.shape}
              mood={brain.mood}
              pupilX={pupilX}
              pupilY={pupilY}
              blink={brain.blink}
            />

            {/* Holding Book Overlay: adorable open book in lap during study mode */}
            <AnimatePresence>
              {brain.mood === "studying" && (
                <HoldingBookOverlay color={comp.color} />
              )}
            </AnimatePresence>
          </div>
        </motion.div>
      </div>

      {/* Bottom Name & Dynamic Hint */}
      <div className="relative z-10 flex flex-col items-center gap-0.5 text-center">
        <span className="text-body font-semibold text-label truncate max-w-[114px]">
          {comp.name || "Companion"}
        </span>
        <span
          className={`text-[10px] transition-colors ${
            brain.mood === "angry"
              ? "text-red-400 font-medium"
              : brain.mood === "vibing-super"
                ? "text-amber-400 font-semibold"
                : brain.mood === "studying"
                  ? "text-blue-400 font-medium"
                  : brain.mood === "vibing-hard" || brain.mood === "vibing-chill"
                    ? "text-[var(--accent,#4285f4)] font-medium"
                    : brain.mood === "petting"
                      ? "text-pink-400 font-medium"
                      : brain.mood === "tickled"
                        ? "text-amber-300 font-medium"
                        : "text-label-3 group-hover:text-label-2"
          }`}
        >
          {hintText}
        </span>
      </div>
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
