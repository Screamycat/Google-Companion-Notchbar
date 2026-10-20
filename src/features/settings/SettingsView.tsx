import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, Reorder } from "motion/react";
import {
  ArrowCounterClockwise,
  CellSignalHigh,
  Check,
  CornersOut,
  DotsSixVertical,
  GearSix,
  ImageSquare,
  Minus,
  MusicNoteSimple,
  Palette,
  Plus,
  Smiley,
  Sparkle,
  SquaresFour,
  UploadSimple,
  X,
  type Icon,
} from "@phosphor-icons/react";
import { useLiveMusicEnergy } from "../companion/companionBrain";
import { fade, springs } from "../../design/motion";
import { autostart, display, type ChangelogEntry, type MonitorInfo } from "../../platform/services";
import { checkForUpdate, installUpdate, update } from "../../lib/update";
import { between, changelog, itemText, markSeen, useUnseen } from "../../lib/changelog";
import { useNowPlaying } from "../../platform/media";
import { findTab } from "../../notch/tabs";
import {
  DEFAULT_NOTCH_TUNING,
  resetNotchTuning,
  settings,
  updateCompanion,
  updateNotch,
  updateSettings,
  type AppearanceEffect,
  type CompanionHat,
  type CompanionEyewear,
  type CompanionShape,
  type Settings,
} from "../../settings/store";
import { Button, Group, Row, Segmented, Select, Slider, Switch } from "../../ui/controls";
import {
  CompanionStage,
  CompanionBody,
  getShapePath,
} from "../companion/CompanionSlot";
import { BackgroundEffects } from "../../notch/BackgroundEffects";
import { Equalizer } from "../now-playing/Equalizer";
import { PlaceSearch } from "../weather/WeatherView";
import { detectPlace } from "../weather/store";

type PageId = "companion" | "appearance" | "geometry" | "tabs" | "general";

const pages: { id: PageId; label: string; icon: Icon }[] = [
  { id: "companion", label: "Companion", icon: Smiley },
  { id: "appearance", label: "Appearance", icon: Palette },
  { id: "geometry", label: "Size & Timing", icon: CornersOut },
  { id: "tabs", label: "Tabs", icon: SquaresFour },
  { id: "general", label: "General", icon: GearSix },
];

let savedPage: PageId = "companion";

const ACCENT_PRESETS = [
  { label: "Google Blue", hex: "#4285f4" },
  { label: "Gemini Purple", hex: "#9b72cb" },
  { label: "Emerald Green", hex: "#34a853" },
  { label: "Amber Yellow", hex: "#fbbc05" },
  { label: "Coral Red", hex: "#ea4335" },
  { label: "Pure White", hex: "#ffffff" },
];

import { DynamicWorldStudio } from "../appearance/DynamicWorldStudio";

const DARK_SHADES = [
  "#000000",
  "#101014",
  "#0d1b2a",
  "#1a1a1e",
  "#12233f",
  "#1f1b3d",
  "#0f2e1f",
  "#ffffff",
];

const EFFECT_ORDER: AppearanceEffect[] = [
  "none",
  "dynamic-world",
  "visualizer",
  "matrix-rain",
  "warp-starfield",
  "waves",
  "pixel-skyline",
  "rainy-window",
  "cozy-fireplace",
  "treehouse",
  "circuits",
  "aurora",
  "ambient",
  "celestial-nebula",
  "chromatic-prism",
  "synthwave",
  "nightsky",
  "holographic",
  "topographic",
  "custom-image",
];

const EFFECT_MUSIC: Record<AppearanceEffect, boolean> = {
  none: false,
  "dynamic-world": false,
  visualizer: true,
  "matrix-rain": true,
  "warp-starfield": true,
  waves: true,
  "pixel-skyline": true,
  "rainy-window": false,
  "cozy-fireplace": false,
  treehouse: false,
  circuits: false,
  "bmo-retro": false,
  aurora: false,
  ambient: false,
  "celestial-nebula": false,
  "chromatic-prism": false,
  synthwave: false,
  nightsky: false,
  holographic: false,
  topographic: false,
  "custom-image": false,
};

type EffectCategory = "all" | "music" | "moving" | "static";

const CATEGORY_MAP: Record<EffectCategory, AppearanceEffect[]> = {
  all: EFFECT_ORDER,
  music: ["visualizer", "matrix-rain", "warp-starfield", "waves", "pixel-skyline"],
  moving: [
    "dynamic-world",
    "rainy-window",
    "cozy-fireplace",
    "treehouse",
    "circuits",
    "aurora",
    "ambient",
    "celestial-nebula",
    "chromatic-prism",
    "topographic",
    "holographic",
  ],
  static: ["custom-image", "synthwave", "nightsky", "none"],
};

/**
 * Clean & Unified Settings View:
 * 1. Companion: Name, shape, color, eyes, accessories, live preview
 * 2. Appearance: Background effects, colors, material, edge glow
 * 3. Size & Shape: Peek size, open size, corner & ear radii
 * 4. Hover & Timing: Open mode, hover delays, trigger strip, spring physics
 * 5. Display & System: Monitor, autostart, weather location
 */
export function SettingsView() {
  const [page, setPageState] = useState<PageId>(savedPage);
  const scroller = useRef<HTMLDivElement>(null);

  const setPage = (p: PageId) => {
    savedPage = p;
    setPageState(p);
  };

  return (
    <div className="flex h-full gap-3 px-4 pt-1 pb-2">
      {/* Settings Navigation Sidebar */}
      <nav className="flex w-[140px] shrink-0 flex-col justify-between">
        <div className="flex flex-col gap-0.5">
          {pages.map((p) => {
            const active = p.id === page;
            return (
              <button
                key={p.id}
                onClick={() => setPage(p.id)}
                aria-current={active ? "page" : undefined}
                className={`pressable relative flex h-8 items-center gap-2 rounded-[8px] px-2.5 text-left text-body transition-colors duration-150 ${
                  active ? "text-label" : "text-label-3 hover:text-label-2"
                }`}
              >
                {active && (
                  <motion.span
                    layoutId="settings-page"
                    className="absolute inset-0 rounded-[8px] bg-fill-2"
                    transition={springs.snappy}
                  />
                )}
                <p.icon size={15} weight={active ? "fill" : "bold"} className="relative shrink-0" />
                <span className="relative truncate">{p.label}</span>
              </button>
            );
          })}
        </div>

        <button
          onClick={resetNotchTuning}
          className="pressable flex h-8 items-center gap-1.5 rounded-[8px] bg-fill-1 px-2.5 text-caption font-medium text-label-2 hover:bg-fill-2 hover:text-label"
          title="Reset all settings to default values"
        >
          <ArrowCounterClockwise size={13} weight="bold" />
          <span className="truncate">Reset Defaults</span>
        </button>
      </nav>

      {/* Active Page Content */}
      <div ref={scroller} className="relative min-w-0 flex-1">
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.div
            key={page}
            className={
              page === "companion"
                ? "absolute inset-0 flex gap-3 overflow-hidden"
                : "absolute inset-0 flex flex-col gap-3.5 overflow-y-auto pr-0.5 pb-6 [scrollbar-width:none]"
            }
            style={
              page === "companion"
                ? undefined
                : { maskImage: "linear-gradient(180deg, #000 calc(100% - 24px), transparent)" }
            }
            initial={{ opacity: 0 }}
            animate={{ opacity: 1, transition: { duration: 0.16 } }}
            exit={{ opacity: 0, transition: { duration: 0.1 } }}
          >
            {page === "companion" && <CompanionPage />}
            {page === "appearance" && <AppearancePage />}
            {page === "geometry" && <SizeAndTimingPage />}
            {page === "tabs" && <TabsPage />}
            {page === "general" && <GeneralPage />}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}

const SHAPES: { id: CompanionShape; label: string }[] = [
  { id: "circle", label: "Circle" },
  { id: "squircle", label: "Squircle" },
  { id: "pill", label: "Capsule" },
  { id: "tower", label: "Tower" },
  { id: "triangle", label: "Triangle" },
  { id: "hexagon", label: "Hexagon" },
  { id: "egg", label: "Egg" },
  { id: "scallop", label: "Scallop" },
  { id: "slime", label: "Slime" },
];

const COMPANION_PALETTES = [
  { color: "#ffffff", label: "Pure White" },
  { color: "#4285f4", label: "Google Blue" },
  { color: "#34a853", label: "Google Mint" },
  { color: "#fbbc05", label: "Amber Gold" },
  { color: "#ea4335", label: "Coral Red" },
  { color: "#9b72cb", label: "Cosmic Purple" },
  { color: "#ec4899", label: "Bubblegum Pink" },
  { color: "#1e1e24", label: "Stealth Obsidian" },
];

function ShapeGrid({
  selected,
  onSelect,
}: {
  selected: CompanionShape;
  onSelect: (shape: CompanionShape) => void;
}) {
  return (
    <div className="grid grid-cols-3 gap-1.5">
      {SHAPES.map((s) => {
        const isSelected =
          selected === s.id ||
          (s.id === "scallop" && selected === "jagged-circle") ||
          (s.id === "tower" && selected === "elongated-rectangle");
        return (
          <button
            key={s.id}
            type="button"
            onClick={() => onSelect(s.id)}
            className={`pressable relative flex h-11 flex-col items-center justify-center gap-0.5 rounded-[10px] border px-1 py-1 transition-all ${
              isSelected
                ? "border-[var(--accent,#4285f4)] bg-fill-2 text-label shadow-[0_0_12px_color-mix(in_srgb,var(--accent,#4285f4)_25%,transparent)]"
                : "border-white/5 bg-fill-1/50 text-label-3 hover:border-white/10 hover:bg-fill-2/60 hover:text-label-2"
            }`}
          >
            <svg viewBox="0 0 100 100" className="size-4 shrink-0 overflow-visible" aria-hidden>
              <path
                d={getShapePath(s.id)}
                fill={isSelected ? "var(--accent, #4285f4)" : "none"}
                fillOpacity={isSelected ? 0.25 : 0}
                stroke={isSelected ? "var(--accent, #4285f4)" : "currentColor"}
                strokeWidth="8"
                strokeLinejoin="round"
              />
            </svg>
            <span className="text-[10px] font-medium leading-none truncate max-w-full">
              {s.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}

/** Page 1: Companion Customization (Live Permanent Stage + Full Controls) */
function CompanionPage() {
  const comp = settings.use().companion;
  const { companionSize } = settings.use().notch;

  return (
    <>
      {/* Permanent, interactive Companion Stage (NEVER scrolls out of view) */}
      <CompanionStage />

      {/* Scrollable Customization Controls */}
      <div
        className="flex-1 overflow-y-auto pr-0.5 pb-6 flex flex-col gap-3 [scrollbar-width:none]"
        style={{ maskImage: "linear-gradient(180deg, #000 calc(100% - 20px), transparent)" }}
      >
        {/* Identity & Aura */}
        <Group title="Identity">
          <Row label="Name" hint="Personal name for your companion">
            <input
              type="text"
              value={comp.name}
              maxLength={18}
              placeholder="Companion"
              onChange={(e) => updateCompanion({ name: e.target.value })}
              className="h-7 w-32 rounded-[8px] bg-fill-2 px-2.5 text-footnote text-label outline-none ring-1 ring-white/10 focus:ring-link"
            />
          </Row>
          <Row label="Ambient Aura" hint="Soft breathing halo behind companion">
            <Switch
              label="Ambient Aura"
              checked={comp.aura}
              onChange={(aura) => updateCompanion({ aura })}
            />
          </Row>
        </Group>

        {/* Body Shape - All 9 smooth/rounded shapes ordered common to obscure */}
        <Group title="Body Shape">
          <div className="px-3 pt-1 pb-2">
            <div className="mb-2 text-[11px] text-label-3">
              9 smooth vector forms with auto-adapting accessories:
            </div>
            <ShapeGrid selected={comp.shape} onSelect={(shape) => updateCompanion({ shape })} />
          </div>
        </Group>

        {/* Body Color - Custom Choice */}
        <Group title="Body Color">
          <Row label="Color Tint" hint="Pick any custom color of your choice">
            <div className="flex items-center gap-1.5 flex-wrap">
              {COMPANION_PALETTES.map((p) => {
                const isSelected = comp.color?.toLowerCase() === p.color.toLowerCase();
                return (
                  <ColorDot
                    key={p.color}
                    color={p.color}
                    label={p.label}
                    selected={isSelected}
                    onPick={() => updateCompanion({ color: p.color })}
                  />
                );
              })}
              <CustomColorDot
                value={comp.color?.startsWith("#") ? comp.color : "#4285f4"}
                selected={
                  !COMPANION_PALETTES.some(
                    (p) => p.color.toLowerCase() === comp.color?.toLowerCase()
                  )
                }
                onPick={(color) => updateCompanion({ color })}
              />
            </div>
          </Row>
        </Group>

        {/* Accessories */}
        <Group title="Accessories">
          <Row
            label="Smart Accessories"
            hint="Auto-swaps hat for headphones during music playback"
          >
            <Switch
              label="Smart Accessories"
              checked={comp.smartAccessories !== false}
              onChange={(smartAccessories) => updateCompanion({ smartAccessories })}
            />
          </Row>
          <Row label="Hat" hint="Headwear slot (auto-tucked during music)">
            <Select<CompanionHat>
              width="w-36"
              value={comp.hat ?? "none"}
              options={[
                { value: "none", label: "None (Clean)" },
                { value: "beanie", label: "Winter Beanie Cap" },
                { value: "crown", label: "Royal Monarch Crown" },
                { value: "halo", label: "Angel Halo" },
                { value: "cap", label: "Baseball Snapback Cap" },
              ]}
              onChange={(hat) => updateCompanion({ hat })}
            />
          </Row>
          <Row label="Eyewear" hint="Face accessory slot (glasses, shades)">
            <Select<CompanionEyewear>
              width="w-36"
              value={comp.eyewear ?? "none"}
              options={[
                { value: "none", label: "None" },
                { value: "glasses", label: "Reading Glasses" },
                { value: "shades", label: "Cool Sunglasses" },
              ]}
              onChange={(eyewear) => updateCompanion({ eyewear })}
            />
          </Row>
          <SliderRow
            label="Base Scale"
            hint="Companion size in dropdown tabs"
            value={companionSize}
            min={50}
            max={120}
            step={2}
            unit="px"
            defaultValue={DEFAULT_NOTCH_TUNING.companionSize}
            onChange={(v) => updateNotch({ companionSize: v })}
            stacked
          />
        </Group>

        {/* Music Vibing Thresholds (0-100) */}
        <VibeThresholdsControl />
      </div>
    </>
  );
}

function VibeRangeBar({
  grooveThreshold,
  dropThreshold,
  liveEnergy,
}: {
  grooveThreshold: number;
  dropThreshold: number;
  liveEnergy: number;
}) {
  const g = Math.max(5, Math.min(95, grooveThreshold));
  const d = Math.max(g + 4, Math.min(100, dropThreshold));

  const isLevel3 = liveEnergy >= d;
  const isLevel2 = !isLevel3 && liveEnergy >= g;
  const isLevel1 = !isLevel3 && !isLevel2;

  return (
    <div className="flex flex-col gap-1.5 px-3 pt-2 pb-1 select-none">
      {/* Zone Legend with Dynamic Active Zone Highlight */}
      <div className="flex items-center justify-between text-[10px] font-medium">
        <span
          className={`flex items-center gap-1 transition-colors ${
            liveEnergy > 0 && isLevel1
              ? "text-sky-300 font-bold drop-shadow-[0_0_6px_rgba(56,189,248,0.5)]"
              : "text-sky-400/80"
          }`}
        >
          <span className="size-1.5 rounded-full bg-sky-400" />
          Level 1: 0–{g}
        </span>
        <span
          className={`flex items-center gap-1 transition-colors ${
            liveEnergy > 0 && isLevel2
              ? "text-amber-300 font-bold drop-shadow-[0_0_6px_rgba(251,191,36,0.5)]"
              : "text-amber-400/80"
          }`}
        >
          <span className="size-1.5 rounded-full bg-amber-400" />
          Level 2: {g}–{d}
        </span>
        <span
          className={`flex items-center gap-1 transition-colors ${
            liveEnergy > 0 && isLevel3
              ? "text-purple-300 font-bold drop-shadow-[0_0_6px_rgba(192,132,252,0.5)]"
              : "text-purple-400/80"
          }`}
        >
          <span className="size-1.5 rounded-full bg-purple-400" />
          Level 3: {d}–100
        </span>
      </div>

      {/* 3-Zone Segmented Bar with Live Needle */}
      <div className="relative h-2.5 w-full overflow-hidden rounded-full bg-fill-2 border border-white/5 flex">
        {/* Chill Zone */}
        <div
          className="h-full bg-sky-500/25 border-r border-sky-400/40 transition-[width] duration-100"
          style={{ width: `${g}%` }}
          title={`Level 1 Chill: 0 to ${g}`}
        />
        {/* Groove Zone */}
        <div
          className="h-full bg-amber-500/30 border-r border-amber-400/40 transition-[width] duration-100"
          style={{ width: `${d - g}%` }}
          title={`Level 2 Groove: ${g} to ${d}`}
        />
        {/* Hype Zone */}
        <div
          className="h-full bg-purple-500/35 transition-[width] duration-100"
          style={{ width: `${100 - d}%` }}
          title={`Level 3 Hype: ${d} to 100`}
        />

        {/* Live track music energy needle */}
        {liveEnergy > 0 && (
          <div
            className="absolute inset-y-0 w-1 bg-white shadow-[0_0_6px_#ffffff] transition-[left] duration-75 -translate-x-1/2 pointer-events-none"
            style={{ left: `${Math.min(100, Math.max(0, liveEnergy))}%` }}
          />
        )}
      </div>

      {/* Live Energy Readout & Companion Vibe State */}
      {liveEnergy > 0 && (
        <div className="flex items-center justify-between text-[10px] text-label-3 pt-0.5">
          <span className="flex items-center gap-1.5">
            <span className="size-1.5 rounded-full bg-green animate-pulse" />
            <span>
              Live Track Energy: <b className="text-label">{liveEnergy}</b> / 100
            </span>
          </span>
          <span
            className={`font-semibold px-2 py-0.5 rounded-full text-[10px] border transition-colors ${
              isLevel3
                ? "bg-purple-500/20 text-purple-300 border-purple-500/40"
                : isLevel2
                  ? "bg-amber-500/20 text-amber-300 border-amber-500/40"
                  : "bg-sky-500/20 text-sky-300 border-sky-500/40"
            }`}
          >
            {isLevel3
              ? "⚡ Level 3: Super Hype"
              : isLevel2
                ? "♫ Level 2: Hard Groove"
                : "♪ Level 1: Chill Sway"}
          </span>
        </div>
      )}
    </div>
  );
}

function EnhancedSlider({
  value,
  min,
  max,
  step = 1,
  color = "#4285f4",
  onChange,
  label,
}: {
  value: number;
  min: number;
  max: number;
  step?: number;
  color?: string;
  onChange: (v: number) => void;
  label: string;
}) {
  const track = useRef<HTMLDivElement>(null);
  const ratio = Math.max(0, Math.min(1, (value - min) / (max - min)));

  const updateFromPointer = (clientX: number) => {
    if (!track.current) return;
    const r = track.current.getBoundingClientRect();
    const rawRatio = Math.max(0, Math.min(1, (clientX - r.left) / r.width));
    const rawVal = min + rawRatio * (max - min);
    const stepped = Math.round(rawVal / step) * step;
    onChange(Math.max(min, Math.min(max, stepped)));
  };

  return (
    <div
      ref={track}
      role="slider"
      tabIndex={0}
      aria-label={label}
      aria-valuenow={value}
      aria-valuemin={min}
      aria-valuemax={max}
      className="group relative flex h-7 w-full cursor-pointer touch-none select-none items-center outline-none"
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        updateFromPointer(e.clientX);
      }}
      onPointerMove={(e) => {
        if (e.currentTarget.hasPointerCapture(e.pointerId)) {
          updateFromPointer(e.clientX);
        }
      }}
      onKeyDown={(e) => {
        if (e.key === "ArrowRight") onChange(Math.min(max, value + step));
        if (e.key === "ArrowLeft") onChange(Math.max(min, value - step));
      }}
    >
      {/* Background Track (8px) */}
      <div className="relative h-2 w-full overflow-hidden rounded-full bg-fill-2 group-hover:bg-fill-3 transition-colors">
        <div
          className="absolute inset-y-0 left-0 rounded-full transition-[width] duration-75"
          style={{
            width: `${ratio * 100}%`,
            backgroundColor: color,
          }}
        />
      </div>

      {/* Tactile Thumb */}
      <span
        className="absolute top-1/2 size-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white/90 bg-white shadow-[0_1px_4px_rgba(0,0,0,0.6)] transition-transform group-hover:scale-115 active:scale-95"
        style={{ left: `${ratio * 100}%` }}
      />
    </div>
  );
}

function ThresholdSliderRow({
  label,
  hint,
  value,
  min,
  max,
  step = 1,
  color,
  defaultValue,
  onChange,
}: {
  label: string;
  hint: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  color?: string;
  defaultValue: number;
  onChange: (val: number) => void;
}) {
  const isModified = value !== defaultValue;

  const nudge = (delta: number) => {
    onChange(Math.max(min, Math.min(max, value + delta)));
  };

  return (
    <div className="flex flex-col gap-1 px-3 py-2 border-t border-separator">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="text-body font-medium text-label truncate">{label}</span>
          {isModified && (
            <button
              type="button"
              onClick={() => onChange(defaultValue)}
              title={`Reset to default (${defaultValue})`}
              className="rounded bg-fill-2 px-1.5 py-0.5 text-[10px] text-label-3 hover:text-label shrink-0"
            >
              Reset
            </button>
          )}
        </div>
        <span
          className="tabular shrink-0 text-right text-caption font-bold px-2 py-0.5 rounded-md"
          style={{
            backgroundColor: color ? `${color}20` : "rgba(255,255,255,0.08)",
            color: color ?? "#ffffff",
          }}
        >
          {value} / 100
        </span>
      </div>

      <div className="text-[11px] text-label-3 leading-snug">{hint}</div>

      <div className="flex items-center gap-2 pt-0.5">
        {/* Decrement Button */}
        <button
          type="button"
          onClick={() => nudge(-5)}
          title="Decrease point by 5"
          className="pressable flex size-6 shrink-0 items-center justify-center rounded-[6px] bg-fill-2 text-label-3 hover:bg-fill-3 hover:text-label active:scale-95 transition"
        >
          <Minus size={11} weight="bold" />
        </button>

        {/* Enhanced Smooth Slider Track */}
        <div className="flex-1">
          <EnhancedSlider
            value={value}
            min={min}
            max={max}
            step={step}
            color={color}
            onChange={onChange}
            label={label}
          />
        </div>

        {/* Increment Button */}
        <button
          type="button"
          onClick={() => nudge(5)}
          title="Increase point by 5"
          className="pressable flex size-6 shrink-0 items-center justify-center rounded-[6px] bg-fill-2 text-label-3 hover:bg-fill-3 hover:text-label active:scale-95 transition"
        >
          <Plus size={11} weight="bold" />
        </button>
      </div>
    </div>
  );
}

function VibeThresholdsControl() {
  const comp = settings.use().companion;
  const liveEnergy = useLiveMusicEnergy();

  const groove = comp.grooveThreshold ?? 35;
  const drop = comp.dropThreshold ?? 65;

  const setGroove = (val: number) => {
    updateCompanion({
      grooveThreshold: val,
      dropThreshold: Math.max(val + 4, drop),
    });
  };

  const setDrop = (val: number) => {
    updateCompanion({
      dropThreshold: val,
      grooveThreshold: Math.min(val - 4, groove),
    });
  };

  const setPreset = (g: number, d: number) => {
    updateCompanion({ grooveThreshold: g, dropThreshold: d });
  };

  return (
    <Group title="Music Vibing Thresholds (0–100)">
      {/* Presets Row */}
      <div className="flex items-center justify-between gap-1.5 px-3 pt-2 pb-1">
        <span className="text-[11px] font-medium text-label-3">Quick Presets:</span>
        <div className="flex items-center gap-1">
          {[
            { label: "Calm", g: 45, d: 80 },
            { label: "Balanced", g: 35, d: 65 },
            { label: "Party", g: 25, d: 50 },
          ].map((p) => {
            const isActive = groove === p.g && drop === p.d;
            return (
              <button
                key={p.label}
                type="button"
                onClick={() => setPreset(p.g, p.d)}
                className={`pressable rounded-full px-2 py-0.5 text-[10px] font-medium transition-colors ${
                  isActive
                    ? "bg-fill-3 text-label ring-1 ring-white/20"
                    : "bg-fill-2 text-label-3 hover:bg-fill-3 hover:text-label-2"
                }`}
              >
                {p.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Visual Multi-Zone Bar with Live Needle */}
      <VibeRangeBar grooveThreshold={groove} dropThreshold={drop} liveEnergy={liveEnergy} />

      {/* Level 2 Threshold Slider */}
      <ThresholdSliderRow
        label="Level 2: Groove Point"
        hint="Energy point where your companion starts head-bobbing and rhythm grooving"
        value={groove}
        min={5}
        max={92}
        step={1}
        color="#f59e0b"
        defaultValue={35}
        onChange={setGroove}
      />

      {/* Level 3 Threshold Slider */}
      <ThresholdSliderRow
        label="Level 3: Hype & Bass Drop"
        hint="Energy point where your companion activates maximum excitement & bass hype"
        value={drop}
        min={15}
        max={99}
        step={1}
        color="#a855f7"
        defaultValue={65}
        onChange={setDrop}
      />
    </Group>
  );
}

/** Page 2: Island Appearance (Background Effects, Colors, Material, Edge Glow) */
function AppearancePage() {
  const a = settings.use().appearance;
  const setAp = (patch: Partial<Settings["appearance"]>) =>
    updateSettings((s) => ({ appearance: { ...s.appearance, ...patch } }));
  const [category, setCategory] = useState<EffectCategory>("all");
  const filteredEffects = CATEGORY_MAP[category] ?? EFFECT_ORDER;
  const fileInputRef = useRef<HTMLInputElement>(null);

  const onUploadFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        setAp({
          effect: "custom-image",
          customWallpaper: {
            dataUrl: reader.result,
            dimming: a.customWallpaper?.dimming ?? 40,
            blur: a.customWallpaper?.blur ?? 0,
            fit: a.customWallpaper?.fit ?? "cover",
          },
        });
      }
    };
    reader.readAsDataURL(file);
  };

  return (
    <>
      {/* Live Miniature Preview */}
      <IslandPreview />

      {/* Background Effects */}
      <section>
        <div className="mb-2 flex items-baseline justify-between gap-2 px-1">
          <h3 className="text-caption font-semibold tracking-wide text-label-3 uppercase">
            Background Effects
          </h3>
          <span className="flex items-center gap-1 text-[11px] text-label-3">
            <MusicNoteSimple size={11} weight="fill" />
            Vibes to music playback
          </span>
        </div>
        <div className="mb-2.5">
          <Segmented
            id="settings-effect-cat"
            size="sm"
            value={category}
            onChange={setCategory}
            options={[
              { value: "all", label: "All" },
              { value: "music", label: "Music" },
              { value: "moving", label: "Moving" },
              { value: "static", label: "Static" },
            ]}
          />
        </div>
        <div className="grid grid-cols-3 gap-2.5">
          {filteredEffects.map((id) => (
            <EffectCard
              key={id}
              id={id}
              selected={a.effect === id}
              onPick={() => setAp({ effect: id })}
            />
          ))}
        </div>
      </section>

      {/* Dynamic World Studio Controls */}
      {a.effect === "dynamic-world" && <DynamicWorldStudio />}

      {/* Custom Wallpaper Controls */}
      {a.effect === "custom-image" && (
        <Group title="Custom Wallpaper">
          <Row label="Image File" hint="Choose PNG, JPG, WEBP, or animated GIF">
            <div className="flex items-center gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif"
                className="hidden"
                onChange={onUploadFile}
              />
              <Button
                onClick={() => fileInputRef.current?.click()}
                icon={UploadSimple}
              >
                {a.customWallpaper?.dataUrl ? "Change Image" : "Upload Image"}
              </Button>
              {a.customWallpaper?.dataUrl && (
                <Button
                  onClick={() =>
                    setAp({
                      customWallpaper: undefined,
                      effect: "none",
                    })
                  }
                  icon={X}
                >
                  Clear
                </Button>
              )}
            </div>
          </Row>
          {a.customWallpaper?.dataUrl && (
            <>
              <Row label="Image Fit">
                <Segmented
                  id="settings-custom-fit"
                  size="sm"
                  value={a.customWallpaper.fit ?? "cover"}
                  onChange={(fit) =>
                    setAp({
                      customWallpaper: {
                        ...a.customWallpaper!,
                        fit: fit as "cover" | "contain",
                      },
                    })
                  }
                  options={[
                    { value: "cover", label: "Cover" },
                    { value: "contain", label: "Contain" },
                  ]}
                />
              </Row>
              <Row label="Dimming" hint="Keeps text and controls legible">
                <div className="flex w-36 items-center gap-2">
                  <Slider
                    label="Dimming"
                    value={a.customWallpaper.dimming ?? 40}
                    min={0}
                    max={85}
                    step={5}
                    onChange={(dimming) =>
                      setAp({
                        customWallpaper: {
                          ...a.customWallpaper!,
                          dimming,
                        },
                      })
                    }
                  />
                  <span className="w-8 text-right text-caption text-label-2 tabular">
                    {a.customWallpaper.dimming ?? 40}%
                  </span>
                </div>
              </Row>
              <Row label="Backdrop Blur">
                <div className="flex w-36 items-center gap-2">
                  <Slider
                    label="Backdrop Blur"
                    value={a.customWallpaper.blur ?? 0}
                    min={0}
                    max={24}
                    step={2}
                    onChange={(blur) =>
                      setAp({
                        customWallpaper: {
                          ...a.customWallpaper!,
                          blur,
                        },
                      })
                    }
                  />
                  <span className="w-8 text-right text-caption text-label-2 tabular">
                    {a.customWallpaper.blur ?? 0}px
                  </span>
                </div>
              </Row>
            </>
          )}
        </Group>
      )}

      {/* Colors & Tinting */}
      <Group title="Colors">
        <Row label="Accent Color" hint="Buttons, highlights, aura, and active dock pills">
          <div className="flex max-w-[280px] flex-wrap items-center justify-end gap-1.5">
            {ACCENT_PRESETS.map((p) => (
              <ColorDot
                key={p.hex}
                color={p.hex}
                label={p.label}
                selected={a.accent.toLowerCase() === p.hex.toLowerCase()}
                onPick={() => setAp({ accent: p.hex })}
              />
            ))}
            <CustomColorDot
              value={a.accent}
              selected={!ACCENT_PRESETS.some((p) => p.hex.toLowerCase() === a.accent.toLowerCase())}
              onPick={(hex) => setAp({ accent: hex })}
            />
          </div>
        </Row>
        <Row label="Resting Notch" hint="Base color of closed island">
          <div className="flex max-w-[280px] flex-wrap items-center justify-end gap-1.5">
            {DARK_SHADES.map((c) => (
              <ColorDot
                key={c}
                color={c}
                label={c}
                selected={a.resting === c}
                onPick={() => setAp({ resting: c })}
              />
            ))}
            <CustomColorDot
              value={a.resting}
              selected={!DARK_SHADES.includes(a.resting)}
              onPick={(c) => setAp({ resting: c })}
            />
          </div>
        </Row>
        <Row label="Expanded Notch" hint="Base color when dropdown is open">
          <div className="flex max-w-[280px] flex-wrap items-center justify-end gap-1.5">
            {DARK_SHADES.map((c) => (
              <ColorDot
                key={c}
                color={c}
                label={c}
                selected={a.expanded === c}
                onPick={() => setAp({ expanded: c })}
              />
            ))}
            <CustomColorDot
              value={a.expanded}
              selected={!DARK_SHADES.includes(a.expanded)}
              onPick={(c) => setAp({ expanded: c })}
            />
          </div>
        </Row>
      </Group>

      {/* Material & Glow */}
      <Group title="Material & Glow">
        <Row label="Island Material" hint="Frosted blur backdrop or solid deep tint">
          <Segmented
            id="appearance-material"
            size="sm"
            value={a.material}
            onChange={(material) => setAp({ material })}
            options={[
              { value: "glass", label: "Frosted Glass" },
              { value: "dark", label: "Dark Glass" },
              { value: "solid", label: "Solid" },
            ]}
          />
        </Row>
        <Row label="Edge Glow" hint="Soft ambient halo in accent color around the notch">
          <Segmented
            id="appearance-glow"
            size="sm"
            value={a.glow}
            onChange={(glow) => setAp({ glow })}
            options={[
              { value: "off", label: "Off" },
              { value: "subtle", label: "Subtle" },
              { value: "strong", label: "Strong" },
            ]}
          />
        </Row>
        <Row label="Card Contrast" hint="Contrast of modular widget tiles over effects">
          <Segmented
            id="appearance-cards"
            size="sm"
            value={a.cards}
            onChange={(cards) => setAp({ cards })}
            options={[
              { value: "light", label: "Light" },
              { value: "dark", label: "Dark" },
              { value: "darker", label: "Darker" },
            ]}
          />
        </Row>
      </Group>
    </>
  );
}

/** Page 3: Merged Size & Timing (without spring physics & open dropdown mode) */
function SizeAndTimingPage() {
  const n = settings.use().notch;

  return (
    <>
      <Group title="Peek Island Dimensions">
        <SliderRow
          label="Peek Width"
          hint="Width of the compact island when hovering the top bezel"
          value={n.peekW}
          min={100}
          max={340}
          step={4}
          unit="px"
          defaultValue={DEFAULT_NOTCH_TUNING.peekW}
          onChange={(peekW) => updateNotch({ peekW })}
        />
        <SliderRow
          label="Peek Height"
          hint="Height of the compact island"
          value={n.peekH}
          min={32}
          max={80}
          step={2}
          unit="px"
          defaultValue={DEFAULT_NOTCH_TUNING.peekH}
          onChange={(peekH) => updateNotch({ peekH })}
        />
      </Group>

      <Group title="Open Notch Dimensions">
        <SliderRow
          label="Dropdown Width"
          hint="Default width of Overview and Music windows"
          value={n.openW}
          min={440}
          max={680}
          step={10}
          unit="px"
          defaultValue={DEFAULT_NOTCH_TUNING.openW}
          onChange={(openW) => updateNotch({ openW })}
        />
        <SliderRow
          label="Dropdown Height"
          hint="Default height of the main windows"
          value={n.openH}
          min={220}
          max={420}
          step={10}
          unit="px"
          defaultValue={DEFAULT_NOTCH_TUNING.openH}
          onChange={(openH) => updateNotch({ openH })}
        />
      </Group>

      <Group title="Island Contours">
        <SliderRow
          label="Bottom Corner Radius"
          hint="Roundness of bottom corners when open"
          value={n.cornerRadius}
          min={12}
          max={42}
          step={2}
          unit="px"
          defaultValue={DEFAULT_NOTCH_TUNING.cornerRadius}
          onChange={(cornerRadius) => updateNotch({ cornerRadius })}
        />
        <SliderRow
          label="Top Ear Radius"
          hint="Concave outward ears that blend the notch into the top screen edge"
          value={n.earRadius}
          min={4}
          max={24}
          step={1}
          unit="px"
          defaultValue={DEFAULT_NOTCH_TUNING.earRadius}
          onChange={(earRadius) => updateNotch({ earRadius })}
        />
      </Group>

      <Group title="Hover & Leave Timing">
        <SliderRow
          label="Peek Hover Duration"
          hint="How long cursor stays in Stage 2 before dropdown opens"
          value={n.hoverDelayMs}
          min={80}
          max={900}
          step={20}
          unit="ms"
          defaultValue={DEFAULT_NOTCH_TUNING.hoverDelayMs}
          onChange={(hoverDelayMs) => updateNotch({ hoverDelayMs })}
        />
        <SliderRow
          label="Leave Grace Delay"
          hint="How long the notch stays open after cursor leaves before closing"
          value={n.leaveDelayMs}
          min={60}
          max={600}
          step={20}
          unit="ms"
          defaultValue={DEFAULT_NOTCH_TUNING.leaveDelayMs}
          onChange={(leaveDelayMs) => updateNotch({ leaveDelayMs })}
        />
      </Group>

      <Group title="Top Trigger Zone">
        <SliderRow
          label="Trigger Zone Width"
          hint="Invisible hit zone width at top center of screen"
          value={n.triggerW}
          min={80}
          max={380}
          step={10}
          unit="px"
          defaultValue={DEFAULT_NOTCH_TUNING.triggerW}
          onChange={(triggerW) => updateNotch({ triggerW })}
        />
        <SliderRow
          label="Trigger Zone Height"
          hint="Height from top bezel that registers hover"
          value={n.triggerH}
          min={2}
          max={18}
          step={1}
          unit="px"
          defaultValue={DEFAULT_NOTCH_TUNING.triggerH}
          onChange={(triggerH) => updateNotch({ triggerH })}
        />
        <Row label="Subtle Hint Line" hint="Show tiny 3px indicator when closed, or keep 100% invisible">
          <Switch
            label="Subtle Hint Line"
            checked={n.showHintLine}
            onChange={(showHintLine) => updateNotch({ showHintLine })}
          />
        </Row>
      </Group>
    </>
  );
}

const GROUP_CHOICES = [
  { value: "main", label: "Group 1" },
  { value: "cat-2", label: "Group 2" },
  { value: "cat-3", label: "Group 3" },
  { value: "cat-4", label: "Group 4" },
];

/** Page 4: Tabs Arrangement, Groups & Dock Dividers */
function TabsPage() {
  const { tools } = settings.use();
  const [dragging, setDragging] = useState<string | null>(null);

  const updateCategory = (id: string, category: string) => {
    updateSettings((s) => ({
      tools: s.tools.map((t) => (t.id === id ? { ...t, category } : t)),
    }));
  };

  const toggleTab = (id: string, enabled: boolean) => {
    const enabledCount = tools.filter((t) => t.enabled).length;
    if (!enabled && enabledCount <= 1) return;
    updateSettings((s) => ({
      tools: s.tools.map((t) => (t.id === id ? { ...t, enabled } : t)),
    }));
  };

  return (
    <>
      <Group title="Dock Tabs">
        <p className="px-3 pb-2 text-[11px] text-label-3">
          Drag tabs vertically to reorder. Different groups are separated by a <code className="rounded bg-fill-2 px-1 text-label font-mono">|</code> divider in the dock.
        </p>

        <Reorder.Group
          as="div"
          axis="y"
          values={tools.map((t) => t.id)}
          onReorder={(ids: string[]) => {
            updateSettings((cur) => ({
              tools: ids.map((id) => cur.tools.find((t) => t.id === id)!),
            }));
          }}
          className="divide-y divide-separator"
        >
          {tools.map((tool) => {
            const meta = findTab(tool.id);
            if (!meta) return null;
            const I = meta.icon;
            const category = tool.category || "main";
            const isDraggingThis = dragging === tool.id;

            return (
              <Reorder.Item
                key={tool.id}
                value={tool.id}
                as="div"
                transition={springs.snappy}
                onDragStart={() => setDragging(tool.id)}
                onDragEnd={() => setDragging(null)}
                whileDrag={{ scale: 1.02 }}
                className={`group relative flex items-center justify-between gap-3 px-3 py-2.5 cursor-grab active:cursor-grabbing select-none transition-colors ${
                  isDraggingThis
                    ? "z-10 rounded-[10px] bg-elevated shadow-[0_6px_18px_rgb(0_0_0/0.45)] ring-1 ring-white/10"
                    : "hover:bg-fill-1/40"
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0 pointer-events-none">
                  <DotsSixVertical
                    size={16}
                    weight="bold"
                    className="text-label-4 shrink-0 transition-colors group-hover:text-label-2"
                  />
                  <div className="flex size-7 shrink-0 items-center justify-center rounded-[8px] bg-fill-2 text-label">
                    <I size={15} weight="bold" />
                  </div>
                  <div className="flex flex-col min-w-0">
                    <span className="text-body font-medium truncate">{meta.label}</span>
                    <span className="text-[11px] text-label-3">
                      {GROUP_CHOICES.find((c) => c.value === category)?.label ?? "Group 1"}
                    </span>
                  </div>
                </div>

                <div
                  className="flex items-center gap-2 shrink-0"
                  onPointerDown={(e) => e.stopPropagation()}
                >
                  {/* Group Selector */}
                  <Select
                    value={category}
                    options={GROUP_CHOICES}
                    onChange={(cat) => updateCategory(tool.id, cat)}
                  />

                  {/* Enable Switch */}
                  <Switch
                    label={meta.label}
                    checked={tool.enabled}
                    onChange={(on) => toggleTab(tool.id, on)}
                  />
                </div>
              </Reorder.Item>
            );
          })}
        </Reorder.Group>
      </Group>
    </>
  );
}

/** Page 5: General System Settings, Display & Updates */
function GeneralPage() {
  const s = settings.use();
  const [monitors, setMonitors] = useState<MonitorInfo[]>([]);
  const [isAutostart, setIsAutostart] = useState(false);
  const u = update.use();
  const unseen = useUnseen();
  const [showLog, setShowLog] = useState(false);

  useEffect(() => {
    void display.monitors().then(setMonitors).catch(() => {});
    void autostart.get().then(setIsAutostart).catch(() => {});
  }, []);

  const monitorOptions = [
    { value: "", label: "Primary Monitor (Default)" },
    ...monitors.map((m) => ({
      value: m.name,
      label: `${m.name}${m.primary ? " (Primary)" : ""} — ${m.width}×${m.height}`,
    })),
  ];

  const busy = u.phase === "checking" || u.phase === "downloading";
  const statusText = {
    idle: u.checkedAt ? `Last checked ${new Date(u.checkedAt).toLocaleTimeString()}` : "Not checked yet",
    checking: "Checking for updates…",
    current: "Up to date",
    available: `Update available: v${u.version}`,
    downloading: `Downloading update… ${Math.round(u.progress * 100)}%`,
    error: "Check failed (no release or network error)",
  }[u.phase];

  return (
    <>
      <Group title="Target Display">
        <Row label="Attach Notch To" hint="Choose which screen hosts the top notch">
          <Select
            value={s.display.monitor ?? ""}
            options={monitorOptions}
            onChange={(val) => {
              const monitor = val === "" ? null : val;
              updateSettings((prev) => ({ display: { ...prev.display, monitor } }));
            }}
          />
        </Row>
      </Group>

      <Group title="System Startup">
        <Row label="Start With Windows" hint="Launch Google NotchBar automatically upon login">
          <Switch
            label="Start with Windows"
            checked={isAutostart}
            onChange={(enable) => {
              setIsAutostart(enable);
              void autostart.set(enable).catch(() => setIsAutostart(!enable));
            }}
          />
        </Row>
      </Group>

      <Group title="Weather Provider">
        <Row
          label="Location"
          hint={
            s.weather
              ? `${s.weather.name}${s.weather.auto ? " (Auto Detected)" : ""}`
              : "Detecting location via IP…"
          }
        >
          {s.weather && !s.weather.auto && (
            <Button
              onClick={() => {
                updateSettings({ weather: null });
                detectPlace();
              }}
            >
              Auto Detect
            </Button>
          )}
        </Row>
        <div className="px-3 py-2">
          <PlaceSearch compact canCancel={false} onDone={() => {}} />
        </div>
      </Group>

      <Group title="Updates & Releases">
        <Row
          label={`Version v${u.current ?? "1.7.0"}`}
          hint={statusText}
        >
          <Button disabled={busy} onClick={() => void checkForUpdate()}>
            {busy ? "Checking…" : "Check for Updates"}
          </Button>
        </Row>
        <AnimatePresence initial={false}>
          {(u.phase === "available" || u.phase === "downloading") && u.version && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} transition={fade} className="overflow-hidden">
              <Row label={`Version v${u.version} available`} hint="Downloads and restarts automatically">
                {u.phase === "downloading" ? (
                  <div className="h-1.5 w-28 overflow-hidden rounded-full bg-fill-2">
                    <div className="h-full origin-left rounded-full bg-label transition-transform duration-150 ease-linear" style={{ transform: `scaleX(${u.progress})` }} />
                  </div>
                ) : (
                  <Button primary onClick={() => void installUpdate()}>
                    Update now
                  </Button>
                )}
              </Row>
            </motion.div>
          )}
        </AnimatePresence>
        <Row
          label={
            <span className="flex items-center gap-1.5">
              <span>What's New</span>
              {unseen.length > 0 && !showLog && <span className="size-[7px] rounded-full bg-link" />}
            </span>
          }
          hint={unseen.length > 0 ? `${unseen.length} new update notes available` : undefined}
        >
          <Button
            onClick={() => {
              if (!showLog) markSeen();
              setShowLog((v) => !v);
            }}
          >
            {showLog ? "Hide" : "View"}
          </Button>
        </Row>
        <AnimatePresence initial={false}>
          {showLog && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} transition={fade} className="overflow-hidden">
              <ChangelogList entries={between(changelog, null, u.current ?? changelog[0].version)} />
            </motion.div>
          )}
        </AnimatePresence>
        <Row label="Check Automatically" hint="Checks GitHub once daily in the background">
          <Switch
            label="Check Automatically"
            checked={s.updates.auto}
            onChange={(auto) => updateSettings({ updates: { auto } })}
          />
        </Row>
      </Group>
    </>
  );
}

function ChangelogList({ entries }: { entries: ChangelogEntry[] }) {
  return (
    <div className="flex flex-col gap-3 px-3 pt-1 pb-3">
      {entries.map((e, i) => (
        <motion.div
          key={e.version}
          initial={{ opacity: 0, transform: "translateY(4px)" }}
          animate={{ opacity: 1, transform: "translateY(0px)", transition: { delay: i * 0.03 } }}
          className="flex flex-col gap-1 border-t border-separator pt-2 first:border-0 first:pt-0"
        >
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-body font-semibold">v{e.version}</span>
            <span className="text-caption text-label-3">{e.date}</span>
          </div>
          <ul className="flex flex-col gap-1 text-caption text-label-2">
            {e.items.map((item, j) => (
              <li key={j} className="flex gap-1.5">
                <span className="text-label-4">•</span>
                <span className="flex-1">{itemText(item)}</span>
              </li>
            ))}
          </ul>
        </motion.div>
      ))}
    </div>
  );
}

/** Reusable Slider Row with live value readout and reset button */
function SliderRow(props: {
  label: string;
  hint?: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit?: string;
  decimals?: number;
  defaultValue: number;
  onChange: (v: number) => void;
  stacked?: boolean;
}) {
  const formatted =
    props.decimals !== undefined ? props.value.toFixed(props.decimals) : String(Math.round(props.value));
  const isModified = Math.abs(props.value - props.defaultValue) > 0.001;

  if (props.stacked) {
    return (
      <div className="flex flex-col gap-1.5 px-3 py-2.5">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="text-body font-medium text-label truncate">{props.label}</span>
            {isModified && (
              <button
                type="button"
                onClick={() => props.onChange(props.defaultValue)}
                title={`Reset to default (${props.defaultValue}${props.unit ? ` ${props.unit}` : ""})`}
                className="rounded bg-fill-2 px-1.5 py-0.5 text-[10px] text-label-3 hover:text-label shrink-0"
              >
                Reset
              </button>
            )}
          </div>
          <span className="tabular shrink-0 text-right text-caption font-semibold text-label-2">
            {formatted}
            {props.unit ? ` ${props.unit}` : ""}
          </span>
        </div>
        {props.hint && (
          <div className="text-caption text-label-3 leading-snug">{props.hint}</div>
        )}
        <div className="pt-0.5">
          <Slider
            label={props.label}
            value={props.value}
            min={props.min}
            max={props.max}
            step={props.step}
            onChange={props.onChange}
          />
        </div>
      </div>
    );
  }

  return (
    <Row
      label={
        <span className="flex items-center gap-1.5">
          <span>{props.label}</span>
          {isModified && (
            <button
              type="button"
              onClick={() => props.onChange(props.defaultValue)}
              title={`Reset to default (${props.defaultValue}${props.unit ? ` ${props.unit}` : ""})`}
              className="rounded bg-fill-2 px-1.5 py-0.5 text-[10px] text-label-3 hover:text-label"
            >
              Reset
            </button>
          )}
        </span>
      }
      hint={props.hint}
    >
      <div className="flex w-44 shrink-0 items-center gap-2.5">
        <Slider
          label={props.label}
          value={props.value}
          min={props.min}
          max={props.max}
          step={props.step}
          onChange={props.onChange}
        />
        <span className="tabular w-12 shrink-0 text-right text-caption font-semibold text-label-2">
          {formatted}
          {props.unit ? ` ${props.unit}` : ""}
        </span>
      </div>
    </Row>
  );
}

/** Live miniature of the island showing resting color, expanded notch, and active background effect */
function IslandPreview() {
  const s = settings.use();
  const a = s.appearance;
  const comp = s.companion;
  const np = useNowPlaying();

  return (
    <div
      aria-hidden
      className="flex flex-col items-center gap-2.5 rounded-[16px] px-6 py-4"
      style={{ background: "linear-gradient(135deg, #1e2638 0%, #2b2742 55%, #38332a 100%)" }}
    >
      {/* Closed notch simulation */}
      <div
        className="flex h-[24px] items-center gap-2 px-3.5"
        style={{
          background: a.resting,
          borderRadius: a.corners === "squared" ? 6 : 999,
          boxShadow: "0 4px 12px rgba(0,0,0,0.5)",
        }}
      >
        <span className="text-[11px] font-medium text-label-2">12:00</span>
        <CellSignalHigh size={11} weight="fill" className="text-label-2" />
        <Equalizer playing={np?.isPlaying ?? false} height={8} />
      </div>

      {/* Expanded notch simulation */}
      <div
        className="relative h-20 w-[260px] overflow-hidden rounded-[14px] bg-black border border-white/5"
        style={{ background: a.expanded }}
      >
        <BackgroundEffects effect={a.effect} playing={np?.isPlaying ?? false} radius={14} />
        <div className="relative z-10 flex h-full items-center justify-between px-4">
          <div className="flex flex-col">
            <span className="text-[11px] font-semibold text-label">Google NotchBar</span>
            <span className="text-[10px] text-label-3">Live Island Preview</span>
          </div>
          {/* Mini Companion sitting inside the preview */}
          <div className="relative flex size-8 shrink-0 items-center justify-center">
            <CompanionBody shape={comp.shape} color={comp.color} />
          </div>
          <span
            className="flex size-6 items-center justify-center rounded-full text-caption"
            style={{ background: a.accent, color: "#fff" }}
          >
            ✓
          </span>
        </div>
      </div>
    </div>
  );
}

/** Effect Picker Card */
function EffectCard({
  id,
  selected,
  onPick,
}: {
  id: AppearanceEffect;
  selected: boolean;
  onPick: () => void;
}) {
  const { name, desc } = getEffectLabel(id);
  return (
    <button
      aria-pressed={selected}
      onClick={onPick}
      className="group text-left transition-transform active:scale-[0.98]"
    >
      <span className="relative block">
        <span
          className="block aspect-[16/10] overflow-hidden rounded-[10px] border border-white/10"
          style={selected ? { outline: "2px solid #4285f4", outlineOffset: 1 } : undefined}
        >
          <EffectThumbnail id={id} />
        </span>
        {EFFECT_MUSIC[id] && (
          <span className="absolute bottom-1 left-1 flex items-center gap-0.5 rounded-full bg-black/75 px-1.5 py-0.5 text-[9px] text-label">
            <MusicNoteSimple size={9} weight="fill" />
            Music
          </span>
        )}
        {id === "dynamic-world" && (
          <span className="absolute bottom-1 left-1 flex items-center gap-1 rounded-full bg-indigo-500/85 px-2 py-0.5 text-[9px] font-semibold text-white shadow-[0_0_8px_rgba(99,102,241,0.6)] backdrop-blur-sm">
            <Sparkle size={9} weight="fill" className="text-amber-300" />
            Studio
          </span>
        )}
        {selected && (
          <span className="absolute -top-1.5 -right-1.5 flex size-4.5 items-center justify-center rounded-full bg-[#4285f4]">
            <Check size={11} weight="bold" className="text-white" />
          </span>
        )}
      </span>
      <span className="mt-1 block truncate text-caption font-medium text-label">{name}</span>
      <span className="block truncate text-[10px] text-label-3">{desc}</span>
    </button>
  );
}

function getEffectLabel(id: AppearanceEffect) {
  switch (id) {
    case "none":
      return { name: "Clean Black", desc: "Minimal obsidian" };
    case "dynamic-world":
      return { name: "Dynamic World", desc: "Real-time weather & day/night studio" };
    case "rainy-window":
      return { name: "Rainy Window", desc: "Cozy trickling drops" };
    case "cozy-fireplace":
      return { name: "Fireplace", desc: "Warm glow & embers" };
    case "treehouse":
      return { name: "Treehouse", desc: "Ghibli canopy & leaves" };
    case "circuits":
    case "bmo-retro":
      return { name: "Circuits", desc: "PCB circuits & scanlines" };
    case "matrix-rain":
      return { name: "Matrix Rain", desc: "Digital code waterfall" };
    case "warp-starfield":
      return { name: "Warp Starfield", desc: "Hyperspace jump trails" };
    case "pixel-skyline":
      return { name: "Pixel Skyline", desc: "8-bit city sunset" };
    case "chromatic-prism":
      return { name: "Prism Refraction", desc: "Rainbow caustic rays" };
    case "celestial-nebula":
      return { name: "Cosmic Nebula", desc: "Swirling stardust clouds" };
    case "visualizer":
      return { name: "Visualizer", desc: "Pulsing audio bars" };
    case "ambient":
      return { name: "Ambient", desc: "Breathing glow" };
    case "waves":
      return { name: "Waves", desc: "Fluid audio tides" };
    case "aurora":
      return { name: "Aurora", desc: "Northern lights" };
    case "synthwave":
      return { name: "Synthwave", desc: "Retro neon horizon" };
    case "nightsky":
      return { name: "Night Sky", desc: "Stars and meteors" };
    case "holographic":
      return { name: "Holographic", desc: "Prismatic shine" };
    case "topographic":
      return { name: "Topographic", desc: "Gentle contour lines" };
    case "custom-image":
      return { name: "Custom Wallpaper", desc: "User image or GIF" };
  }
}

function EffectThumbnail({ id }: { id: AppearanceEffect }) {
  const custom = settings.use().appearance.customWallpaper;
  if (id === "none") return <span className="block h-full w-full bg-black" />;
  if (id === "custom-image") {
    if (custom?.dataUrl) {
      return (
        <span className="relative block h-full w-full overflow-hidden bg-black">
          <img src={custom.dataUrl} alt="" className="size-full object-cover" />
          <span className="absolute inset-0 bg-black/30" />
        </span>
      );
    }
    return (
      <span className="flex h-full w-full flex-col items-center justify-center gap-1 border border-dashed border-white/20 bg-fill-1 text-label-3">
        <ImageSquare size={18} weight="duotone" />
        <span className="text-[9px]">Custom Image</span>
      </span>
    );
  }
  if (id === "dynamic-world")
    return (
      <span className="relative block h-full w-full overflow-hidden bg-gradient-to-b from-[#1e40af] via-[#38bdf8] to-[#93c5fd]">
        <span className="absolute top-1 right-2 size-2 rounded-full bg-amber-300 shadow-[0_0_4px_rgba(252,211,77,0.9)]" />
        <svg viewBox="0 0 100 40" preserveAspectRatio="none" className="absolute bottom-0 w-full h-4 opacity-70">
          <path d="M 0 40 L 0 25 L 25 15 L 50 25 L 75 10 L 100 20 L 100 40 Z" fill="#1e293b" />
        </svg>
        <span className="absolute top-1.5 left-2 size-1 rounded-full bg-white/70" />
      </span>
    );
  if (id === "rainy-window")
    return (
      <span className="relative block h-full w-full overflow-hidden bg-gradient-to-b from-[#080c16] to-[#121a2d]">
        {[
          [15, 20, 14],
          [35, 10, 20],
          [55, 30, 16],
          [75, 15, 18],
          [25, 55, 18],
          [68, 60, 14],
        ].map(([x, y, l], i) => (
          <span
            key={i}
            className="absolute w-[1.5px] rounded-full bg-sky-200/60"
            style={{ left: `${x}%`, top: `${y}%`, height: l }}
          />
        ))}
      </span>
    );
  if (id === "cozy-fireplace")
    return (
      <span className="relative block h-full w-full overflow-hidden bg-[#070403]">
        <span className="absolute -bottom-4 left-1/2 h-12 w-24 -translate-x-1/2 rounded-full bg-gradient-to-t from-orange-600/80 via-amber-500/50 to-transparent blur-sm" />
        {[
          [35, 60],
          [45, 45],
          [55, 55],
          [65, 40],
        ].map(([x, y], i) => (
          <span
            key={i}
            className="absolute size-1 rounded-full bg-amber-300 shadow-[0_0_4px_rgba(251,191,36,0.9)]"
            style={{ left: `${x}%`, top: `${y}%` }}
          />
        ))}
      </span>
    );
  if (id === "treehouse")
    return (
      <span className="relative block h-full w-full overflow-hidden bg-gradient-to-b from-[#1c1917] via-[#292524] to-[#0c0a09]">
        <span className="absolute -top-3 left-1/2 size-12 -translate-x-1/2 rounded-full bg-amber-500/30 blur-sm" />
        <span className="absolute bottom-0 inset-x-0 h-4 bg-[#05080f] opacity-80" />
        <span className="absolute top-0 left-2 w-3 h-6 bg-emerald-500/60 rounded-b-full blur-[0.5px]" />
        <span className="absolute top-0 right-3 w-3 h-7 bg-green-500/60 rounded-b-full blur-[0.5px]" />
      </span>
    );
  if (id === "circuits" || id === "bmo-retro")
    return (
      <span className="relative block h-full w-full overflow-hidden bg-gradient-to-b from-[#0e2723] via-[#091c19] to-[#05110f]">
        <span
          className="absolute top-1.5 right-2 size-1 rounded-full"
          style={{ backgroundColor: "var(--accent, #34d399)", boxShadow: "0 0 4px var(--accent, rgba(52,211,153,0.9))" }}
        />
        <svg viewBox="0 0 100 60" className="absolute inset-0 size-full opacity-60">
          <path d="M 10 10 L 40 10 L 60 30 L 90 30" fill="none" stroke="var(--accent, #2dd4bf)" strokeWidth="1.5" />
        </svg>
        <span className="absolute inset-0 opacity-25" style={{ background: "repeating-linear-gradient(0deg, rgba(0,0,0,0.5) 0 1px, transparent 1px 3px)" }} />
      </span>
    );
  if (id === "matrix-rain")
    return (
      <span className="relative block h-full w-full overflow-hidden bg-[#040906] font-mono text-[6px] text-emerald-400">
        {[
          [15, 0],
          [35, -5],
          [55, 8],
          [75, -2],
        ].map(([x, y], i) => (
          <span key={i} className="absolute flex flex-col leading-none" style={{ left: `${x}%`, top: `${y}px` }}>
            <span className="text-white">1</span>
            <span className="text-emerald-300">0</span>
            <span className="text-emerald-500">1</span>
          </span>
        ))}
      </span>
    );
  if (id === "warp-starfield")
    return (
      <span className="relative block h-full w-full overflow-hidden bg-[#030308]">
        {[
          [20, 20, 50, 50],
          [80, 25, 50, 50],
          [20, 80, 50, 50],
          [80, 75, 50, 50],
        ].map(([x2, y2, x1, y1], i) => (
          <svg key={i} className="absolute inset-0 size-full">
            <line x1={`${x1}%`} y1={`${y1}%`} x2={`${x2}%`} y2={`${y2}%`} stroke="rgba(255,255,255,0.8)" strokeWidth="1.2" strokeLinecap="round" />
          </svg>
        ))}
      </span>
    );
  if (id === "pixel-skyline")
    return (
      <span className="relative block h-full w-full overflow-hidden bg-gradient-to-b from-[#180828] via-[#381446] to-[#0c0316]">
        <span className="absolute top-1.5 right-3 size-2.5 bg-amber-200/90 shadow-[0_0_4px_rgba(253,230,138,0.6)]" />
        <svg viewBox="0 0 100 40" preserveAspectRatio="none" className="absolute bottom-0 w-full h-6">
          <path d="M 0 40 L 0 20 L 20 20 L 20 12 L 40 12 L 40 40 L 65 40 L 65 16 L 85 16 L 85 40 Z" fill="#0d0417" />
          <rect x="25" y="18" width="2.5" height="2.5" fill="#fef08a" />
          <rect x="70" y="22" width="2.5" height="2.5" fill="#67e8f9" />
        </svg>
      </span>
    );
  if (id === "chromatic-prism")
    return (
      <span className="relative block h-full w-full overflow-hidden bg-[#07080e]">
        <span
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(135deg, transparent 15%, rgba(255,80,120,0.3) 35%, rgba(255,210,80,0.3) 50%, rgba(80,230,255,0.3) 65%, transparent 85%)",
          }}
        />
        <span className="absolute top-0 bottom-0 left-[45%] w-6 -rotate-45 bg-white/20 blur-[4px]" />
      </span>
    );
  if (id === "celestial-nebula")
    return (
      <span className="relative block h-full w-full overflow-hidden bg-[#04030a]">
        <span className="absolute top-[-10%] left-[10%] size-12 rounded-full bg-violet-600/40 blur-sm" />
        <span className="absolute bottom-[-10%] right-[10%] size-10 rounded-full bg-pink-600/35 blur-sm" />
        <span className="absolute top-[30%] left-[45%] size-8 rounded-full bg-cyan-500/30 blur-sm" />
      </span>
    );
  if (id === "visualizer")
    return (
      <span className="relative flex h-full w-full items-end justify-center gap-[2.5px] overflow-hidden bg-black px-2 pt-2 pb-1.5">
        {[40, 65, 85, 55, 95, 75, 90, 65, 80, 50, 70].map((h, i) => (
          <span
            key={i}
            className="relative w-full rounded-full"
            style={{
              height: `${h}%`,
              background: "linear-gradient(180deg, #8ff5ff, #4285f4 55%, #7b3fe4)",
            }}
          />
        ))}
      </span>
    );
  if (id === "ambient")
    return (
      <span
        className="relative block h-full w-full overflow-hidden"
        style={{ background: "linear-gradient(180deg, #0b1040 0%, #060818 100%)" }}
      >
        <span className="absolute top-[-25%] left-[2%] h-[95%] w-[60%] rounded-full bg-indigo-500/70 blur-md" />
        <span className="absolute top-[5%] right-[-5%] h-[85%] w-[55%] rounded-full bg-fuchsia-500/60 blur-md" />
      </span>
    );
  if (id === "waves")
    return (
      <span className="block h-full w-full bg-[#06121f]">
        <svg viewBox="0 0 160 100" preserveAspectRatio="none" className="h-full w-full">
          <path d="M0 62 Q 20 48, 40 60 T 80 58 T 120 62 T 160 56 L160 100 L0 100 Z" fill="rgb(52 211 153 / 0.4)" />
          <path d="M0 72 Q 20 60, 40 70 T 80 68 T 120 72 T 160 66 L160 100 L0 100 Z" fill="rgb(34 211 238 / 0.5)" />
        </svg>
      </span>
    );
  if (id === "aurora")
    return (
      <span className="relative block h-full w-full overflow-hidden bg-[#030b14]">
        <span className="absolute -inset-1 opacity-70 blur-sm" style={{ background: "linear-gradient(135deg, #00f5a0 0%, #00d9f5 40%, #7b2ff7 100%)" }} />
      </span>
    );
  if (id === "nightsky")
    return (
      <span className="relative block h-full w-full overflow-hidden bg-[#04060d]">
        {[
          [20, 25],
          [45, 15],
          [75, 35],
          [30, 60],
          [80, 70],
        ].map(([x, y], i) => (
          <span key={i} className="absolute size-[2px] rounded-full bg-white/90" style={{ left: `${x}%`, top: `${y}%` }} />
        ))}
      </span>
    );
  if (id === "holographic")
    return (
      <span
        className="relative block h-full w-full overflow-hidden bg-[#0b0a16]"
        style={{
          background:
            "linear-gradient(115deg, transparent 5%, rgb(224 123 255 / 0.4) 30%, rgb(92 225 230 / 0.4) 50%, rgb(255 214 10 / 0.3) 70%, transparent 95%)",
        }}
      />
    );
  if (id === "topographic")
    return (
      <span className="block h-full w-full bg-[#070604]">
        <svg viewBox="0 0 160 100" preserveAspectRatio="xMidYMid slice" className="h-full w-full">
          <g fill="none" stroke="#ff9f0a" strokeWidth="1">
            <ellipse cx="80" cy="58" rx="20" ry="14" opacity="0.8" />
            <ellipse cx="80" cy="58" rx="40" ry="28" opacity="0.55" />
            <ellipse cx="80" cy="58" rx="65" ry="44" opacity="0.35" />
          </g>
        </svg>
      </span>
    );
  return (
    <span
      className="relative block h-full w-full overflow-hidden"
      style={{ background: "linear-gradient(180deg, #150833 0%, #7a2a86 60%, #0d0518 61%, #0d0518 100%)" }}
    />
  );
}

/** Color Swatch Dot with checkmark */
function ColorDot({
  color,
  label,
  selected,
  onPick,
}: {
  color: string;
  label: string;
  selected: boolean;
  onPick: () => void;
}) {
  const isLight = color === "#ffffff";
  return (
    <button
      aria-label={label}
      title={label}
      aria-pressed={selected}
      onClick={onPick}
      className="flex size-6 items-center justify-center rounded-full ring-1 ring-white/15 transition-transform active:scale-95"
      style={{
        background: color,
        outline: selected ? `2px solid ${isLight ? "#1a1a1a" : "#ffffff"}` : "none",
        outlineOffset: 1,
      }}
    >
      {selected && <Check size={11} weight="bold" style={{ color: isLight ? "#000" : "#fff" }} />}
    </button>
  );
}

/** Rainbow custom color picker dot */
function CustomColorDot({
  value,
  selected,
  onPick,
}: {
  value: string;
  selected: boolean;
  onPick: (c: string) => void;
}) {
  return (
    <label
      title="Custom Color"
      className="relative flex size-6 cursor-pointer items-center justify-center rounded-full ring-1 ring-white/15 transition-transform active:scale-95"
      style={{
        background: "conic-gradient(from 0deg, #ea4335, #fbbc05, #34a853, #4285f4, #9b72cb, #ea4335)",
        outline: selected ? "2px solid #fff" : "none",
        outlineOffset: 1,
      }}
    >
      <input
        type="color"
        aria-label="Custom Color Picker"
        value={value}
        onChange={(e) => onPick(e.target.value)}
        className="absolute inset-0 cursor-pointer opacity-0"
      />
      {selected && <Check size={11} weight="bold" className="pointer-events-none text-white drop-shadow" />}
    </label>
  );
}
