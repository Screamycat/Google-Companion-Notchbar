import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  ArrowCounterClockwise,
  CellSignalHigh,
  Check,
  CornersOut,
  Monitor,
  MusicNoteSimple,
  Palette,
  SlidersHorizontal,
  Smiley,
  type Icon,
} from "@phosphor-icons/react";
import { springs } from "../../design/motion";
import { autostart, display, type MonitorInfo } from "../../platform/services";
import { useNowPlaying } from "../../platform/media";
import {
  DEFAULT_NOTCH_TUNING,
  resetNotchTuning,
  settings,
  updateCompanion,
  updateNotch,
  updateSettings,
  type AppearanceEffect,
  type CompanionAccessory,
  type CompanionColor,
  type CompanionEyes,
  type CompanionShape,
  type Settings,
} from "../../settings/store";
import { Button, Group, Row, Segmented, Select, Slider, Switch } from "../../ui/controls";
import { CompanionPreviewCard } from "../companion/CompanionSlot";
import { BackgroundEffects } from "../../notch/BackgroundEffects";
import { Equalizer } from "../now-playing/Equalizer";
import { PlaceSearch } from "../weather/WeatherView";
import { detectPlace } from "../weather/store";

type PageId = "companion" | "appearance" | "geometry" | "timing" | "system";

const pages: { id: PageId; label: string; icon: Icon }[] = [
  { id: "companion", label: "Companion", icon: Smiley },
  { id: "appearance", label: "Appearance", icon: Palette },
  { id: "geometry", label: "Size & Shape", icon: CornersOut },
  { id: "timing", label: "Hover & Timing", icon: SlidersHorizontal },
  { id: "system", label: "Display & System", icon: Monitor },
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
  "visualizer",
  "ambient",
  "waves",
  "aurora",
  "holographic",
  "topographic",
  "synthwave",
  "nightsky",
];

const EFFECT_MUSIC: Record<AppearanceEffect, boolean> = {
  none: false,
  visualizer: true,
  ambient: true,
  waves: true,
  aurora: true,
  holographic: false,
  topographic: false,
  synthwave: false,
  nightsky: false,
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
      <nav className="flex w-[148px] shrink-0 flex-col justify-between">
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
            className="absolute inset-0 flex flex-col gap-3.5 overflow-y-auto pr-0.5 pb-6 [scrollbar-width:none]"
            style={{ maskImage: "linear-gradient(180deg, #000 calc(100% - 24px), transparent)" }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1, transition: { duration: 0.16 } }}
            exit={{ opacity: 0, transition: { duration: 0.1 } }}
          >
            {page === "companion" && <CompanionPage />}
            {page === "appearance" && <AppearancePage />}
            {page === "geometry" && <GeometryPage />}
            {page === "timing" && <TimingPage />}
            {page === "system" && <SystemPage />}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}

/** Page 1: Companion Customization (Name, Shape, Colors, Eyes, Accessories, Live Preview) */
function CompanionPage() {
  const comp = settings.use().companion;
  const { companionSize } = settings.use().notch;

  return (
    <>
      {/* Interactive Live Preview */}
      <CompanionPreviewCard />

      {/* Identity & Aura */}
      <Group title="Identity">
        <Row label="Companion Name" hint="Give your dynamic companion a name">
          <input
            type="text"
            value={comp.name}
            maxLength={18}
            placeholder="e.g. Gigi"
            onChange={(e) => updateCompanion({ name: e.target.value })}
            className="h-7 w-36 rounded-[8px] bg-fill-2 px-2.5 text-footnote text-label outline-none ring-1 ring-white/10 focus:ring-link"
          />
        </Row>
        <Row label="Ambient Aura Glow" hint="Soft breathing halo behind the companion">
          <Switch
            label="Ambient Aura Glow"
            checked={comp.aura}
            onChange={(aura) => updateCompanion({ aura })}
          />
        </Row>
      </Group>

      {/* Body Shape */}
      <Group title="Body Shape">
        <Row label="Companion Form" hint="Choose the companion's geometry (headphones adapt automatically)">
          <Segmented<CompanionShape>
            id="companion-shape"
            size="sm"
            value={comp.shape}
            options={[
              { value: "circle", label: "Circle" },
              { value: "squircle", label: "Squircle" },
              { value: "pill", label: "Capsule" },
              { value: "egg", label: "Egg" },
            ]}
            onChange={(shape) => updateCompanion({ shape })}
          />
        </Row>
      </Group>

      {/* Color & Material */}
      <Group title="Color & Material">
        <Row label="Body Finish" hint="Frosted glass or Google ecosystem color tints">
          <Select<CompanionColor>
            value={comp.color}
            options={[
              { value: "glass", label: "Classic Frosted Glass" },
              { value: "gemini", label: "Gemini Cosmic Gradient" },
              { value: "accent", label: "Dynamic Accent Tint" },
              { value: "dark", label: "Stealth Obsidian Glass" },
              { value: "mint", label: "Google Mint Emerald" },
              { value: "amber", label: "Google Amber Gold" },
              { value: "coral", label: "Google Coral Red" },
            ]}
            onChange={(color) => updateCompanion({ color })}
          />
        </Row>
      </Group>

      {/* Eyes & Expression */}
      <Group title="Expression">
        <Row label="Eyes Style" hint="Facial expression when in open windows">
          <Segmented<CompanionEyes>
            id="companion-eyes"
            size="sm"
            value={comp.eyes}
            options={[
              { value: "happy", label: "Happy (^ ^)" },
              { value: "curious", label: "Curious (o o)" },
              { value: "anime", label: "Anime (★ ★)" },
              { value: "cool", label: "Shades (■ ■)" },
            ]}
            onChange={(eyes) => updateCompanion({ eyes })}
          />
        </Row>
      </Group>

      {/* Accessories */}
      <Group title="Accessories">
        <Row label="Companion Accessory" hint="Headphones adapt cleanly to any chosen body shape">
          <Select<CompanionAccessory>
            value={comp.accessory}
            options={[
              { value: "auto", label: "Smart Music (On playback)" },
              { value: "headphones", label: "Headphones (Always on)" },
              { value: "beanie", label: "Winter Beanie Cap" },
              { value: "halo", label: "Golden Angel Halo" },
              { value: "crown", label: "Royal Monarch Crown" },
              { value: "none", label: "None (Clean)" },
            ]}
            onChange={(accessory) => updateCompanion({ accessory })}
          />
        </Row>
        <SliderRow
          label="Companion Size"
          hint="Scale of the companion in open dropdown tabs"
          value={companionSize}
          min={50}
          max={120}
          step={2}
          unit="px"
          defaultValue={DEFAULT_NOTCH_TUNING.companionSize}
          onChange={(v) => updateNotch({ companionSize: v })}
        />
      </Group>
    </>
  );
}

/** Page 2: Island Appearance (Background Effects, Colors, Material, Edge Glow) */
function AppearancePage() {
  const a = settings.use().appearance;
  const setAp = (patch: Partial<Settings["appearance"]>) =>
    updateSettings((s) => ({ appearance: { ...s.appearance, ...patch } }));

  return (
    <>
      {/* Live Miniature Preview */}
      <IslandPreview />

      {/* Background Effects */}
      <section>
        <div className="mb-1.5 flex items-baseline justify-between gap-2 px-1">
          <h3 className="text-caption font-semibold tracking-wide text-label-3 uppercase">
            Background Effects
          </h3>
          <span className="flex items-center gap-1 text-[11px] text-label-3">
            <MusicNoteSimple size={11} weight="fill" />
            Vibes to music playback
          </span>
        </div>
        <div className="grid grid-cols-3 gap-2.5">
          {EFFECT_ORDER.map((id) => (
            <EffectCard
              key={id}
              id={id}
              selected={a.effect === id}
              onPick={() => setAp({ effect: id })}
            />
          ))}
        </div>
      </section>

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

/** Page 3: Island Geometry & Radii */
function GeometryPage() {
  const n = settings.use().notch;

  return (
    <>
      <Group title="Stage 2 (Peek Island)">
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

      <Group title="Stage 3 (Open Dropdown)">
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
    </>
  );
}

/** Page 4: Hover Durations, Triggers & Spring Physics */
function TimingPage() {
  const n = settings.use().notch;

  return (
    <>
      <Group title="Stage 2 → Stage 3 Interaction">
        <Row label="Open Dropdown Mode" hint="Expand after holding hover in Peek, or require a click">
          <Segmented
            id="open-mode"
            size="sm"
            value={n.openMode}
            options={[
              { value: "hover", label: "Hold Hover" },
              { value: "click", label: "Click" },
            ]}
            onChange={(openMode) => updateNotch({ openMode })}
          />
        </Row>
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

      <Group title="Stage 1 (Hidden Hover Zone)">
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

      <Group title="Spring Physics">
        <SliderRow
          label="Open Spring Duration"
          hint="Speed of opening dropdown expansion"
          value={n.openDuration}
          min={0.2}
          max={0.7}
          step={0.02}
          unit="s"
          decimals={2}
          defaultValue={DEFAULT_NOTCH_TUNING.openDuration}
          onChange={(openDuration) => updateNotch({ openDuration })}
        />
        <SliderRow
          label="Open Spring Bounce"
          hint="Playful overshoot bounce on open (0 = smooth, 0.4 = bouncy)"
          value={n.openBounce}
          min={0}
          max={0.45}
          step={0.02}
          decimals={2}
          defaultValue={DEFAULT_NOTCH_TUNING.openBounce}
          onChange={(openBounce) => updateNotch({ openBounce })}
        />
        <SliderRow
          label="Tab Morph Speed"
          hint="Duration of size adjustments between tabs"
          value={n.morphDuration}
          min={0.16}
          max={0.55}
          step={0.02}
          unit="s"
          decimals={2}
          defaultValue={DEFAULT_NOTCH_TUNING.morphDuration}
          onChange={(morphDuration) => updateNotch({ morphDuration })}
        />
      </Group>
    </>
  );
}

/** Page 5: Display Selection, Autostart & Weather */
function SystemPage() {
  const s = settings.use();
  const [monitors, setMonitors] = useState<MonitorInfo[]>([]);
  const [isAutostart, setIsAutostart] = useState(false);

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
    </>
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
}) {
  const formatted =
    props.decimals !== undefined ? props.value.toFixed(props.decimals) : String(Math.round(props.value));
  const isModified = Math.abs(props.value - props.defaultValue) > 0.001;

  return (
    <Row
      label={
        <span className="flex items-center gap-1.5">
          <span>{props.label}</span>
          {isModified && (
            <button
              onClick={() => props.onChange(props.defaultValue)}
              title={`Reset to default (${props.defaultValue}${props.unit ?? ""})`}
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
  const a = settings.use().appearance;
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
  }
}

function EffectThumbnail({ id }: { id: AppearanceEffect }) {
  if (id === "none") return <span className="block h-full w-full bg-black" />;
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
