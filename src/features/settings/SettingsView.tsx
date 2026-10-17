import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  ArrowCounterClockwise,
  ArrowsInLineHorizontal,
  CornersOut,
  Lightning,
  Monitor,
  SlidersHorizontal,
  type Icon,
} from "@phosphor-icons/react";
import { content, springs } from "../../design/motion";
import { autostart, display, type MonitorInfo } from "../../platform/services";
import {
  DEFAULT_NOTCH_TUNING,
  resetNotchTuning,
  settings,
  updateNotch,
  updateSettings,
} from "../../settings/store";
import { Button, Group, Row, Segmented, Select, Slider, Switch } from "../../ui/controls";
import { PlaceSearch } from "../weather/WeatherView";
import { detectPlace } from "../weather/store";

type PageId = "behavior" | "geometry" | "motion" | "system";

const pages: { id: PageId; label: string; icon: Icon }[] = [
  { id: "behavior", label: "Hover & Timing", icon: SlidersHorizontal },
  { id: "geometry", label: "Size & Shape", icon: CornersOut },
  { id: "motion", label: "Animations", icon: Lightning },
  { id: "system", label: "Display & System", icon: Monitor },
];

let savedPage: PageId = "behavior";

const ACCENT_PRESETS = [
  { label: "Google Blue", hex: "#4285f4" },
  { label: "Gemini Purple", hex: "#9b72cb" },
  { label: "Emerald", hex: "#34a853" },
  { label: "Amber", hex: "#fbbc05" },
  { label: "Coral Red", hex: "#ea4335" },
  { label: "Pure White", hex: "#ffffff" },
];

/**
 * Custom Settings view for Google NotchBar.
 * Exposes all live variables for our 3-stage notch setup (hover duration, stage sizes,
 * corner/ear radii, companion size, spring speeds/bounces, and display/system options).
 * Companion is hidden in Settings for now.
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
      <nav className="flex w-[144px] shrink-0 flex-col justify-between">
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
          title="Reset all notch tuning sliders to default values"
        >
          <ArrowCounterClockwise size={13} weight="bold" />
          <span className="truncate">Reset Defaults</span>
        </button>
      </nav>

      <div ref={scroller} className="relative min-w-0 flex-1">
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.div
            key={page}
            className="absolute inset-0 flex flex-col gap-3.5 overflow-y-auto pr-0.5 pb-6 [scrollbar-width:none]"
            style={{ maskImage: "linear-gradient(180deg, #000 calc(100% - 24px), transparent)" }}
            initial={{ opacity: 0, filter: "blur(4px)" }}
            animate={{ opacity: 1, filter: "blur(0px)", transition: content.enter }}
            exit={{ opacity: 0, filter: "blur(4px)", transition: content.exit }}
          >
            {page === "behavior" && <BehaviorPage />}
            {page === "geometry" && <GeometryPage />}
            {page === "motion" && <MotionPage />}
            {page === "system" && <SystemPage />}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}

/** Page 1: Hover durations, open mode, and Stage 1 trigger zone. */
function BehaviorPage() {
  const n = settings.use().notch;

  return (
    <>
      <Group title="Stage 2 → Stage 3 Trigger">
        <Row label="Open Dropdown Mode" hint="Expand after holding hover in Peek, or require a click">
          <Segmented
            id="open-mode"
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
          max={1000}
          step={20}
          unit="ms"
          defaultValue={DEFAULT_NOTCH_TUNING.hoverDelayMs}
          onChange={(hoverDelayMs) => updateNotch({ hoverDelayMs })}
        />
        <SliderRow
          label="Leave Grace Delay"
          hint="Grace time before notch closes after cursor leaves"
          value={n.leaveDelayMs}
          min={40}
          max={600}
          step={20}
          unit="ms"
          defaultValue={DEFAULT_NOTCH_TUNING.leaveDelayMs}
          onChange={(leaveDelayMs) => updateNotch({ leaveDelayMs })}
        />
      </Group>

      <Group title="Stage 1 — Hidden Top Trigger Zone">
        <Row label="Show Subtle Hint Line" hint="Off = 100% invisible until cursor touches top center">
          <Switch
            label="Show Subtle Hint Line"
            checked={n.showHintLine}
            onChange={(showHintLine) => updateNotch({ showHintLine })}
          />
        </Row>
        <SliderRow
          label="Trigger Zone Width"
          hint="Width of invisible hover target at top-center screen edge"
          value={n.triggerW}
          min={80}
          max={400}
          step={10}
          unit="px"
          defaultValue={DEFAULT_NOTCH_TUNING.triggerW}
          onChange={(triggerW) => updateNotch({ triggerW })}
        />
        <SliderRow
          label="Trigger Zone Height"
          hint="Height of invisible top-edge hover strip"
          value={n.triggerH}
          min={2}
          max={20}
          step={1}
          unit="px"
          defaultValue={DEFAULT_NOTCH_TUNING.triggerH}
          onChange={(triggerH) => updateNotch({ triggerH })}
        />
      </Group>
    </>
  );
}

/** Page 2: Stage 2 Peek size, Stage 3 Open dropdown size, corner/ear radii, and Companion size. */
function GeometryPage() {
  const n = settings.use().notch;

  return (
    <>
      <Group title="Companion">
        <SliderRow
          label="Companion Size"
          hint="Diameter of our companion in Overview & Music tabs"
          value={n.companionSize}
          min={48}
          max={110}
          step={2}
          unit="px"
          defaultValue={DEFAULT_NOTCH_TUNING.companionSize}
          onChange={(companionSize) => updateNotch({ companionSize })}
        />
      </Group>

      <Group title="Stage 2 — Peek Island">
        <SliderRow
          label="Peek Width"
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
          value={n.peekH}
          min={28}
          max={90}
          step={2}
          unit="px"
          defaultValue={DEFAULT_NOTCH_TUNING.peekH}
          onChange={(peekH) => updateNotch({ peekH })}
        />
      </Group>

      <Group title="Stage 3 — Open Dropdown & Shape">
        <SliderRow
          label="Dropdown Width"
          value={n.openW}
          min={420}
          max={700}
          step={10}
          unit="px"
          defaultValue={DEFAULT_NOTCH_TUNING.openW}
          onChange={(openW) => updateNotch({ openW })}
        />
        <SliderRow
          label="Dropdown Height"
          value={n.openH}
          min={220}
          max={480}
          step={10}
          unit="px"
          defaultValue={DEFAULT_NOTCH_TUNING.openH}
          onChange={(openH) => updateNotch({ openH })}
        />
        <SliderRow
          label="Bottom Corner Radius"
          value={n.cornerRadius}
          min={12}
          max={44}
          step={1}
          unit="px"
          defaultValue={DEFAULT_NOTCH_TUNING.cornerRadius}
          onChange={(cornerRadius) => updateNotch({ cornerRadius })}
        />
        <SliderRow
          label="Top Ear Curve Radius"
          value={n.earRadius}
          min={6}
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

/** Page 3: Spring durations and bounce physics for every stage transition. */
function MotionPage() {
  const n = settings.use().notch;

  return (
    <>
      <Group title="Peek Animation (Stage 1 → Stage 2)">
        <SliderRow
          label="Peek Duration"
          value={n.peekDuration}
          min={0.12}
          max={0.7}
          step={0.02}
          unit="s"
          decimals={2}
          defaultValue={DEFAULT_NOTCH_TUNING.peekDuration}
          onChange={(peekDuration) => updateNotch({ peekDuration })}
        />
        <SliderRow
          label="Peek Bounce"
          value={n.peekBounce}
          min={0}
          max={0.5}
          step={0.02}
          decimals={2}
          defaultValue={DEFAULT_NOTCH_TUNING.peekBounce}
          onChange={(peekBounce) => updateNotch({ peekBounce })}
        />
      </Group>

      <Group title="Dropdown Expand (Stage 2 → Stage 3)">
        <SliderRow
          label="Open Duration"
          value={n.openDuration}
          min={0.16}
          max={0.8}
          step={0.02}
          unit="s"
          decimals={2}
          defaultValue={DEFAULT_NOTCH_TUNING.openDuration}
          onChange={(openDuration) => updateNotch({ openDuration })}
        />
        <SliderRow
          label="Open Bounce"
          value={n.openBounce}
          min={0}
          max={0.5}
          step={0.02}
          decimals={2}
          defaultValue={DEFAULT_NOTCH_TUNING.openBounce}
          onChange={(openBounce) => updateNotch({ openBounce })}
        />
      </Group>

      <Group title="Close & Companion Gliding">
        <SliderRow
          label="Close Duration"
          value={n.closeDuration}
          min={0.12}
          max={0.7}
          step={0.02}
          unit="s"
          decimals={2}
          defaultValue={DEFAULT_NOTCH_TUNING.closeDuration}
          onChange={(closeDuration) => updateNotch({ closeDuration })}
        />
        <SliderRow
          label="Close Bounce"
          value={n.closeBounce}
          min={0}
          max={0.4}
          step={0.02}
          decimals={2}
          defaultValue={DEFAULT_NOTCH_TUNING.closeBounce}
          onChange={(closeBounce) => updateNotch({ closeBounce })}
        />
        <SliderRow
          label="Companion & Tab Morph Speed"
          hint="Spring speed when Companion glides between Overview and Music"
          value={n.morphDuration}
          min={0.14}
          max={0.7}
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

/** Page 4: Reused display, appearance surface, weather location, and Windows startup settings. */
function SystemPage() {
  const s = settings.use();
  const [monitors, setMonitors] = useState<MonitorInfo[]>([]);
  const [auto, setAuto] = useState<boolean | null>(null);

  useEffect(() => {
    void display.monitors().then(setMonitors);
    void autostart.get().then(setAuto);
  }, []);

  const currentMonitor =
    s.display.monitor && monitors.some((m) => m.name === s.display.monitor) ? s.display.monitor : "";

  return (
    <>
      <Group title="Display & Window">
        {monitors.length > 1 && (
          <Row label="Monitor">
            <Select
              value={currentMonitor}
              width="w-44"
              options={[
                { value: "", label: "Primary Monitor" },
                ...monitors.map((m, i) => ({
                  value: m.name,
                  label: `Display ${i + 1} (${m.width}×${m.height})`,
                })),
              ]}
              onChange={(v) => updateSettings((x) => ({ display: { ...x.display, monitor: v || null } }))}
            />
          </Row>
        )}
        <Row label="Fullscreen Apps" hint="Hide notch while a fullscreen game or video is active">
          <Segmented
            id="fullscreen-vis"
            value={s.display.visibility}
            options={[
              { value: "always", label: "Stay Visible" },
              { value: "hide-fullscreen", label: "Auto-Hide" },
            ]}
            onChange={(visibility) => updateSettings((x) => ({ display: { ...x.display, visibility } }))}
          />
        </Row>
        {s.display.offset !== 0 && (
          <Row label="Horizontal Position" hint="Dragged away from screen center">
            <Button
              icon={ArrowsInLineHorizontal}
              onClick={() => updateSettings((x) => ({ display: { ...x.display, offset: 0 } }))}
            >
              Center
            </Button>
          </Row>
        )}
      </Group>

      <Group title="Surface & Theme">
        <Row label="Dropdown Material">
          <Segmented
            id="surface-mat"
            value={s.appearance.material}
            options={[
              { value: "solid", label: "Solid" },
              { value: "dark", label: "Translucent" },
              { value: "glass", label: "Glass" },
            ]}
            onChange={(material) => updateSettings((x) => ({ appearance: { ...x.appearance, material } }))}
          />
        </Row>
        <Row label="Card Contrast">
          <Segmented
            id="card-tier"
            value={s.appearance.cards}
            options={[
              { value: "darker", label: "Subtle" },
              { value: "dark", label: "Balanced" },
              { value: "light", label: "Bright" },
            ]}
            onChange={(cards) => updateSettings((x) => ({ appearance: { ...x.appearance, cards } }))}
          />
        </Row>
        <Row label="Accent Color">
          <div className="flex items-center gap-1.5">
            {ACCENT_PRESETS.map((c) => {
              const active = s.appearance.accent.toLowerCase() === c.hex.toLowerCase();
              return (
                <button
                  key={c.hex}
                  title={c.label}
                  onClick={() => updateSettings((x) => ({ appearance: { ...x.appearance, accent: c.hex } }))}
                  className={`pressable size-5 rounded-full transition-transform ${
                    active ? "scale-110 ring-2 ring-white ring-offset-1 ring-offset-black" : "opacity-75 hover:opacity-100"
                  }`}
                  style={{ backgroundColor: c.hex }}
                />
              );
            })}
          </div>
        </Row>
      </Group>

      <Group title="System & Weather">
        <Row label="Start with Windows" hint="Launch Google NotchBar automatically on sign-in">
          <Switch
            label="Start with Windows"
            checked={auto ?? true}
            onChange={(on) => {
              setAuto(on);
              void autostart.set(on);
            }}
          />
        </Row>
        <Row label="Language">
          <Segmented
            id="lang"
            value={s.language}
            options={[
              { value: "en", label: "English" },
              { value: "de", label: "Deutsch" },
            ]}
            onChange={(language) => updateSettings({ language })}
          />
        </Row>
        <Row
          label="Weather Location"
          hint={
            s.weather
              ? `${s.weather.name}${s.weather.auto ? " (Auto)" : ""}`
              : "Detecting via IP…"
          }
        >
          {s.weather && !s.weather.auto && (
            <Button
              onClick={() => {
                updateSettings({ weather: null });
                detectPlace();
              }}
            >
              Auto
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
