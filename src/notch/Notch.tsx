import { Fragment, useEffect, useLayoutEffect, useRef, useState, type RefObject } from "react";
import { AnimatePresence, LayoutGroup, motion, type Transition } from "motion/react";
import {
  Minus,
  Pause,
  Play,
  PushPin,
  SkipBack,
  SkipForward,
  SunDim,
  X,
} from "@phosphor-icons/react";
import { content, springs } from "../design/motion";
import { media, useNowPlaying } from "../platform/media";
import { isNative, hitExtra, keyboardFocus, onNativeBlur, onNativeHover, onShortcut, onTrayOpen, setHitRect, setMemoryLow } from "../platform/native";
import { useDragToMove } from "./drag";
import { DOCK_HEIGHT, HEADER_HEIGHT, stageGeometry, type NotchGeometry } from "./geometry";
import { HeaderButton, headerSlot } from "./header";
import { sizeOverride } from "./size";
import { NotchShape } from "./NotchShape";
import { BackgroundEffects } from "./BackgroundEffects";
import { settings, type NotchTuning } from "../settings/store";
import { markSeen, useUnseen } from "../lib/changelog";
import { nav, navigate } from "./nav";
import { update } from "../lib/update";
import { findTab, settingsTab, tabs, type NotchTab } from "./tabs";
import { holdOpen, pinned, togglePin, useNotchState, type NotchStatus } from "./useNotchState";
import { NotchCompanion } from "../features/companion/CompanionSlot";
import { describe, useForecast } from "../features/weather/store";
import { formatTemp } from "../lib/format";
import { t } from "../i18n";

/** Closed this long → lower WebView2's memory target. */
const MEMORY_LOW_AFTER_MS = 20_000;

export function Notch() {
  const { status, open, close, dismiss, toggle, minimize, onPointerEnter, onPointerLeave } = useNotchState();
  const { tools: toolSettings, appearance, notch: notchTuning } = settings.use();

  const enabledTabs = toolSettings
    .filter((t) => t.enabled)
    .map((t) => {
      const base = findTab(t.id);
      if (!base) return null;
      return { ...base, category: t.category || base.category };
    })
    .filter((t): t is NotchTab => !!t);
  const dockTabs: NotchTab[] = [...(enabledTabs.length > 0 ? enabledTabs : tabs), settingsTab];

  const { tabId } = nav.use();
  const tab = dockTabs.find((t) => t.id === tabId) ?? dockTabs[0];
  const np = useNowPlaying();

  // Tray open target (e.g. Settings)
  const prevStatus = useRef(status);
  const trayTab = useRef<string | null>(null);
  useLayoutEffect(() => {
    if (status === "open" && prevStatus.current !== "open" && trayTab.current) {
      navigate(trayTab.current);
      trayTab.current = null;
    }
    prevStatus.current = status;
  });

  const override = sizeOverride.use();
  // Use live notchTuning openW/openH as the base open size for main tabs,
  // while allowing Settings or expanded Mixer to use their height when needed,
  // and media tab uses 224px height to avoid empty dead space.
  const baseSize =
    tab.id === settingsTab.id
      ? { w: Math.max(notchTuning.openW, settingsTab.size.w), h: Math.max(notchTuning.openH, settingsTab.size.h) }
      : tab.id === "media"
        ? { w: notchTuning.openW, h: 224 }
        : tab.id === "clipboard"
          ? { w: Math.max(notchTuning.openW, 580), h: 232 }
          : { w: notchTuning.openW, h: notchTuning.openH };
  const size = override?.tabId === tab.id ? { w: baseSize.w, h: override.h } : baseSize;

  const isMusicActive = Boolean(np && (np.isPlaying || np.title));
  const stages = stageGeometry(notchTuning, size, isMusicActive);
  const shape =
    status === "open"
      ? stages.open
      : status === "peek"
        ? stages.peek
        : stages.closed;

  const rootRef = useRef<HTMLDivElement>(null);
  const cycling = appearance.accent === "cycle";
  useEffect(() => {
    const el = rootRef.current;
    if (!el || !cycling) return;
    let h = Math.floor((Date.now() / 50) % 360);
    const id = window.setInterval(() => {
      h = (h + 3) % 360;
      el.style.setProperty("--appearance-accent", `hsl(${h} 85% 62%)`);
    }, 100);
    return () => window.clearInterval(id);
  }, [cycling]);
  useEffect(() => {
    if (!cycling) rootRef.current?.style.removeProperty("--appearance-accent");
  }, [cycling]);

  const fills = CARD_FILLS[appearance.cards];
  const hasExpandedBg = status !== "closed";
  const chromeBg = hasExpandedBg ? appearance.expanded : appearance.resting;
  const chromeLight = luminance(chromeBg) > 0.55;
  const ink = chromeLight ? "0 0 0" : "255 255 255";
  const tone = {
    solid: chromeBg,
    wash: !hasExpandedBg
      ? null
      : appearance.material === "glass"
        ? { color: `color-mix(in srgb, ${appearance.expanded} 55%, transparent)`, blur: 18 }
        : appearance.material === "dark"
          ? { color: `color-mix(in srgb, ${appearance.expanded} 80%, transparent)`, blur: 10 }
          : null,
    glow:
      appearance.glow === "off"
        ? null
        : appearance.glow === "subtle"
          ? "0 0 26px -4px color-mix(in srgb, var(--appearance-accent) 45%, transparent)"
          : "0 0 52px -2px color-mix(in srgb, var(--appearance-accent) 65%, transparent)",
  };

  const shaped =
    appearance.corners === "squared" && status !== "closed"
      ? { ...shape, r: Math.max(3, Math.round(shape.r * 0.35)) }
      : shape;
  const sticky = useStickyHitZone(status, size.h);
  const transition = useTransitionFor(status, shaped, notchTuning);

  // Click outside closes (in the browser the fake desktop, in Tauri the window blur).
  const hitRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const onDown = (e: PointerEvent) => {
      if (!hitRef.current?.contains(e.target as Node)) dismiss();
    };
    window.addEventListener("pointerdown", onDown);
    const offBlur = onNativeBlur(dismiss);
    return () => {
      window.removeEventListener("pointerdown", onDown);
      offBlur();
    };
  }, [dismiss]);

  useNativeBridge(hitRef, onPointerEnter, onPointerLeave);
  const drag = useDragToMove(status);

  // Wheel over empty areas or the dock flips across tabs (including Settings).
  const wheelLock = useRef(0);
  const onWheel = (e: React.WheelEvent) => {
    if (e.deltaY === 0 || dockTabs.length < 2) return;
    const t = e.target as Element | null;
    if (t instanceof Element) {
      if (t.closest("input, textarea, select, [role=slider], [role=listbox], [data-wheel-keep]")) return;
      let el: Element | null = t;
      while (el && el !== e.currentTarget) {
        if (el instanceof HTMLElement && (el.scrollHeight > el.clientHeight + 4 || el.scrollWidth > el.clientWidth + 4)) return;
        el = el.parentElement;
      }
    }
    const now = Date.now();
    if (now - wheelLock.current < 260) return;
    wheelLock.current = now;
    const i = dockTabs.findIndex((v) => v.id === tab.id);
    const next =
      e.deltaY > 0
        ? i < 0
          ? dockTabs[0]
          : dockTabs[(i + 1) % dockTabs.length]
        : i <= 0
          ? dockTabs[dockTabs.length - 1]
          : dockTabs[i - 1];
    if (next && next.id !== tab.id) navigate(next.id);
  };

  const onClick = (e: React.MouseEvent) => {
    if (drag.moved() || isInteractive(e.target)) return;
    if (status !== "open") {
      open();
      pinned.set(true);
    }
  };

  useEffect(() => onShortcut(() => toggle() === "open" && keyboardFocus(true)), [toggle]);
  useEffect(
    () =>
      onTrayOpen((targetTab) => {
        trayTab.current = status === "open" ? null : targetTab;
        if (targetTab) navigate(targetTab);
        open();
        keyboardFocus(true);
      }),
    [open, status],
  );
  useEffect(() => {
    if (status === "closed") keyboardFocus(false);
  }, [status]);

  useEffect(() => {
    if (status !== "closed") return setMemoryLow(false);
    const id = window.setTimeout(() => setMemoryLow(true), MEMORY_LOW_AFTER_MS);
    return () => window.clearTimeout(id);
  }, [status]);

  // 1–3 switches dock tabs while open and not typing.
  useEffect(() => {
    if (status !== "open") return;
    const onKey = (e: KeyboardEvent) => {
      if (isTextField(e.target) || e.ctrlKey || e.altKey || e.metaKey) return;
      const target = dockTabs[Number(e.key) - 1];
      if (target) navigate(target.id);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [status, dockTabs]);

  // Stage 1 (closed): maintain the invisible hover trigger strip (triggerW x triggerH)
  // so Rust hit_test.rs detects when the cursor enters the top-center of the screen.
  const hitMinHeight =
    status === "closed"
      ? Math.max(notchTuning.triggerH, shaped.h)
      : sticky.minHeight;
  const hitMinWidth =
    status === "closed"
      ? Math.max(notchTuning.triggerW, shaped.w)
      : undefined;

  return (
    <LayoutGroup>
      <div
        ref={rootRef}
        className="pointer-events-none fixed inset-x-0 top-0 z-50 flex justify-center transition-opacity duration-200"
        style={{
          ["--accent" as string]: np?.accent ?? (cycling ? "#4285f4" : appearance.accent),
          ["--appearance-accent" as string]: cycling ? "#4285f4" : appearance.accent,
          ["--color-fill-1" as string]: `rgb(${ink} / ${fills[0]})`,
          ["--color-fill-2" as string]: `rgb(${ink} / ${fills[1]})`,
          ["--color-fill-3" as string]: `rgb(${ink} / ${fills[2]})`,
          ["--color-notch" as string]: chromeBg,
          ["--color-label-3" as string]: `rgb(${ink} / ${boost(chromeLight ? 0.38 : 0.34, appearance.subtext)})`,
          ["--dock-icon" as string]: `rgb(${ink} / ${boost(0.34, appearance.icons)})`,
          ["--dock-filter" as string]: `brightness(${Math.min(3, appearance.icons).toFixed(2)})`,
          ...(chromeLight
            ? {
                ["--color-label" as string]: "rgb(0 0 0 / 0.92)",
                ["--color-label-2" as string]: "rgb(0 0 0 / 0.6)",
                ["--color-label-4" as string]: "rgb(0 0 0 / 0.2)",
                ["--color-separator" as string]: "rgb(0 0 0 / 0.08)",
                ["--color-elevated" as string]: "#f2f2f6",
              }
            : null),
          transform: isNative ? undefined : `translateX(${drag.offset}px)`,
        }}
      >
        <div
          ref={hitRef}
          data-notch-hit
          className={`pointer-events-auto flex justify-center ${
            status === "closed" ? "px-1 pb-0.5" : "px-4 pb-3"
          }`}
          style={{
            minHeight: hitMinHeight,
            minWidth: hitMinWidth,
            cursor: drag.dragging ? "grabbing" : status === "peek" ? "pointer" : undefined,
          }}
          onPointerMove={sticky.onPointerMove}
          onPointerDown={drag.onPointerDown}
          onPointerEnter={isNative ? undefined : onPointerEnter}
          onPointerLeave={isNative ? undefined : onPointerLeave}
          onClick={onClick}
        >
          <NotchShape geometry={shaped} transition={transition} elevated={status !== "closed"} tone={tone}>
            {/* Background animated effects for both peek and open states */}
            {status !== "closed" && appearance.effect !== "none" && (
              <BackgroundEffects effect={appearance.effect} playing={np?.isPlaying ?? false} radius={shaped.r} />
            )}

            {/* Stage 2 (Peek / Minimized Tiny Island): Living space for BMO */}
            <AnimatePresence>
              {status === "peek" && <TinyIslandContent key="tiny-island" np={np} />}
            </AnimatePresence>

            {/* Stage 3 (Open Dropdown): Header + Active Tab + Categorized Bottom Dock */}
            <AnimatePresence>
              {status === "open" && (
                <motion.div
                  key="open"
                  className="absolute top-0 left-1/2 flex flex-col"
                  style={{ width: size.w, height: size.h, marginLeft: -size.w / 2 }}
                  onWheel={onWheel}
                  initial={{ opacity: 0, transform: "translateY(-4px)" }}
                  animate={{ opacity: 1, transform: "translateY(0px)", transition: { duration: 0.16, ease: [0.23, 1, 0.32, 1] } }}
                  exit={{ opacity: 0, transform: "translateY(-4px)", transition: { duration: 0.1 } }}
                >
                  <Header
                    title={t(tab.label)}
                    onDragStart={drag.onPointerDown}
                    onMinimize={minimize}
                    onClose={close}
                  />
                  <div className="relative min-h-0 flex-1 overflow-clip">
                    <AnimatePresence mode="popLayout" initial={false}>
                      <motion.div
                        key={tab.id}
                        className="absolute inset-0"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1, transition: { duration: 0.15 } }}
                        exit={{ opacity: 0, transition: { duration: 0.1 } }}
                      >
                        <tab.View />
                      </motion.div>
                    </AnimatePresence>
                  </div>
                  <Dock tabs={dockTabs} activeId={tab.id} />
                </motion.div>
              )}
            </AnimatePresence>

            {/* Persistent Living Companion: always ready, continuous, zero lag/fade/blur across Peek & Open */}
            <NotchCompanion
              status={status}
              activeTab={tab.id}
              size={size}
              geometry={shaped}
            />
          </NotchShape>
        </div>
      </div>
    </LayoutGroup>
  );
}

/** Header: tool title on the left, actions + pin + minimize + close on the right. */
function Header({
  title,
  onDragStart,
  onMinimize,
  onClose,
}: {
  title: string;
  onDragStart: (e: React.PointerEvent) => void;
  onMinimize?: () => void;
  onClose?: () => void;
}) {
  const isPinned = pinned.use();
  return (
    <div
      data-drag-handle
      onPointerDown={onDragStart}
      className="relative flex shrink-0 items-center justify-between gap-3 pr-3 pl-5"
      style={{ height: HEADER_HEIGHT + 4 }}
    >
      <div className="relative min-w-0 flex-1">
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.h2
            key={title}
            className="truncate text-title font-semibold"
            initial={{ opacity: 0, filter: "blur(4px)" }}
            animate={{ opacity: 1, filter: "blur(0px)", transition: content.enter }}
            exit={{ opacity: 0, filter: "blur(4px)", transition: content.exit }}
          >
            {title}
          </motion.h2>
        </AnimatePresence>
      </div>
      <div className="flex items-center gap-1">
        <div ref={(el) => headerSlot.set(el)} className="grid" />
        <HeaderButton label={isPinned ? "Unpin" : "Keep Open"} active={isPinned} onClick={togglePin}>
          <PushPin size={14} weight={isPinned ? "fill" : "bold"} />
        </HeaderButton>
        {onMinimize && (
          <HeaderButton label="Minimize" onClick={onMinimize}>
            <Minus size={14} weight="bold" />
          </HeaderButton>
        )}
        {onClose && (
          <HeaderButton label="Close" onClick={onClose}>
            <X size={14} weight="bold" />
          </HeaderButton>
        )}
      </div>
    </div>
  );
}

/**
 * Categorized bottom dock:
 * Renders tabs in order, placing a vertical `|` separator whenever `tab.category` changes
 * (e.g. `[Overview] [Music] | [Settings]`).
 */
function Dock({
  tabs,
  activeId,
}: {
  tabs: NotchTab[];
  activeId: string;
}) {
  const lastMainTool = useRef(tabs[0]?.id ?? "overview");
  if (activeId !== settingsTab.id) lastMainTool.current = activeId;
  const updateReady = update.use().phase === "available";
  const unseen = useUnseen().length > 0;
  const badge = updateReady || unseen;

  return (
    <div className="relative flex shrink-0 items-start justify-center gap-1 px-4 pt-1" style={{ height: DOCK_HEIGHT }}>
      {tabs.map((tab, index) => {
        const prevCategory = index > 0 ? tabs[index - 1].category : tab.category;
        const showDivider = index > 0 && prevCategory !== tab.category;
        const isSettings = tab.id === settingsTab.id;
        const isActive = tab.id === activeId;

        return (
          <Fragment key={tab.id}>
            {showDivider && <span aria-hidden className="mx-1.5 mt-2 h-4 w-px bg-separator" />}
            <DockButton
              label={t(tab.label)}
              icon={tab.icon}
              active={isActive}
              badge={isSettings ? badge : undefined}
              onClick={() => {
                if (isSettings && isActive) {
                  navigate(lastMainTool.current);
                } else {
                  if (isSettings) markSeen();
                  navigate(tab.id);
                }
              }}
            />
          </Fragment>
        );
      })}
    </div>
  );
}

function DockButton(props: { label: string; icon: NotchTab["icon"]; active: boolean; onClick: () => void; badge?: boolean }) {
  const I = props.icon;
  return (
    <button
      aria-label={props.label}
      title={props.label}
      onClick={props.onClick}
      className={`pressable relative flex h-8 w-8 items-center justify-center rounded-[10px] ${
        props.active ? "text-label" : "text-[var(--dock-icon)] hover:text-label-2 [filter:var(--dock-filter)]"
      }`}
    >
      {props.active && <motion.span layoutId="dock-pill" className="absolute inset-0 rounded-[10px] bg-fill-2" transition={springs.snappy} />}
      <I size={16} weight={props.active ? "fill" : "bold"} className="relative" />
      <AnimatePresence>
        {props.badge && (
          <motion.span
            className="absolute top-1 right-1 size-[7px] rounded-full bg-link ring-2 ring-notch"
            initial={{ opacity: 0, transform: "scale(0.9)" }}
            animate={{ opacity: 1, transform: "scale(1)" }}
            exit={{ opacity: 0, transform: "scale(0.9)" }}
            transition={springs.snappy}
          />
        )}
      </AnimatePresence>
    </button>
  );
}

function useStickyHitZone(status: NotchStatus, height: number) {
  const [minHeight, setMinHeight] = useState<number | undefined>(undefined);
  const prev = useRef(height);
  useLayoutEffect(() => {
    if (status !== "open") setMinHeight(undefined);
    else if (height < prev.current) {
      const from = prev.current + HIT_PAD_BOTTOM;
      setMinHeight((m) => Math.max(m ?? 0, from));
    }
    prev.current = height;
  }, [status, height]);

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (minHeight === undefined) return;
    const shapeBottom = e.currentTarget.getBoundingClientRect().top + height;
    if (e.clientY < shapeBottom) setMinHeight(undefined);
  };
  return { minHeight, onPointerMove };
}

const HIT_PAD_BOTTOM = 12;

const CARD_FILLS = {
  light: ["0.10", "0.16", "0.24"],
  dark: ["0.06", "0.10", "0.16"],
  darker: ["0.03", "0.06", "0.10"],
} as const;

function luminance(hex: string): number {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function boost(base: number, by: number): string {
  return Math.min(0.9, base * (Number.isFinite(by) ? by : 1)).toFixed(2);
}

/** Picks the spring for the transition using the live NotchTuning settings. */
function useTransitionFor(status: NotchStatus, shape: NotchGeometry, tuning: NotchTuning): Transition {
  const prev = useRef(status);
  const key = `${shape.w}x${shape.h}x${shape.r}x${shape.ear}`;
  const prevKey = useRef(key);

  let t: Transition;
  if (status === "open") {
    t =
      prev.current === "open"
        ? { type: "spring", visualDuration: tuning.morphDuration, bounce: 0.14 }
        : { type: "spring", visualDuration: tuning.openDuration, bounce: tuning.openBounce };
  } else if (status === "peek") {
    t = { type: "spring", visualDuration: tuning.peekDuration, bounce: tuning.peekBounce };
  } else {
    t = { type: "spring", visualDuration: tuning.closeDuration, bounce: tuning.closeBounce };
  }

  const stable = useRef(t);
  if (prevKey.current !== key) stable.current = t;

  useEffect(() => {
    prev.current = status;
    prevKey.current = key;
  });

  return stable.current;
}

/**
 * Link to the native shell: reports the hit zone to Rust (click-through), receives
 * hover from the Rust poll and keeps the window clickable while typing.
 */
function useNativeBridge(
  hitRef: RefObject<HTMLDivElement | null>,
  onEnter: () => void,
  onLeave: () => void,
) {
  useEffect(() => {
    const el = hitRef.current;
    if (!isNative || !el) return;

    const report = () => {
      const r = el.getBoundingClientRect();
      const extra = hitExtra.get();
      if (!extra) {
        setHitRect({ x: r.x, y: r.y, w: r.width, h: r.height });
        return;
      }
      const x = Math.min(r.x, extra.x);
      const y = Math.min(r.y, extra.y);
      setHitRect({
        x,
        y,
        w: Math.max(r.x + r.width, extra.x + extra.w) - x,
        h: Math.max(r.y + r.height, extra.x + extra.h) - y,
      });
    };
    const ro = new ResizeObserver(report);
    ro.observe(el);
    report();
    const offExtra = hitExtra.subscribe(report);

    const offHover = onNativeHover((inside) => (inside ? onEnter() : onLeave()));
    let typing = false;
    const onFocusIn = (e: FocusEvent) => {
      if (isTextField(e.target) && !typing) holdOpen((typing = true));
    };
    const onFocusOut = (e: FocusEvent) => {
      if (typing && !isTextField(e.relatedTarget)) holdOpen((typing = false));
    };
    el.addEventListener("focusin", onFocusIn);
    el.addEventListener("focusout", onFocusOut);

    return () => {
      ro.disconnect();
      offExtra();
      offHover();
      el.removeEventListener("focusin", onFocusIn);
      el.removeEventListener("focusout", onFocusOut);
      if (typing) holdOpen(false);
    };
  }, [hitRef, onEnter, onLeave]);
}

function isInteractive(el: EventTarget | null): boolean {
  return el instanceof Element && !!el.closest("button, input, textarea, a, [role=slider]");
}

function isTextField(el: EventTarget | null): boolean {
  return el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement;
}

/**
 * Stage 2 (Peek / Minimized Tiny Island):
 * Compact living space for BMO on the desktop.
 * - When idle: BMO chills on the left, weather info displays on the right.
 * - When music is active: BMO grooves with headphones on the left, track title in the middle,
 *   and compact interactive media playback controls (Prev, Play/Pause, Next) on the right.
 * - Clicking controls performs playback with stopPropagation (without expanding);
 *   clicking anywhere else on the island opens Stage 3.
 */
function TinyIslandContent({
  np,
}: {
  np: ReturnType<typeof useNowPlaying>;
}) {
  const forecast = useForecast();
  const s = settings.use();
  const place = s.weather;
  const comp = s.companion;
  const weather =
    forecast && forecast !== "error"
      ? describe(forecast.current.code, forecast.current.day)
      : null;

  const isMusic = Boolean(np && (np.isPlaying || np.title));

  return (
    <motion.div
      key="tiny-island"
      className="absolute inset-0 flex items-center select-none overflow-hidden"
      style={{ paddingLeft: 46, paddingRight: 10 }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1, transition: { duration: 0.16 } }}
      exit={{ opacity: 0, transition: { duration: 0.1 } }}
    >
      <AnimatePresence mode="popLayout" initial={false}>
        {isMusic && np ? (
          <motion.div
            key="music"
            className="flex min-w-0 flex-1 items-center justify-between gap-2"
            initial={{ opacity: 0, filter: "blur(4px)" }}
            animate={{ opacity: 1, filter: "blur(0px)", transition: content.enter }}
            exit={{ opacity: 0, filter: "blur(4px)", transition: content.exit }}
          >
            {/* Song title and artist */}
            <div className="flex min-w-0 flex-1 flex-col justify-center leading-tight">
              <span className="truncate text-xs font-semibold text-label">
                {np.title}
              </span>
              {np.artist && (
                <span className="truncate text-[10px] text-label-3">
                  {np.artist}
                </span>
              )}
            </div>

            {/* Media controls */}
            <div className="flex shrink-0 items-center gap-0.5">
              <button
                type="button"
                title="Previous Track"
                onClick={(e) => {
                  e.stopPropagation();
                  void media.previous();
                }}
                className="pressable flex size-6 items-center justify-center rounded-full text-label-2 hover:bg-white/10 hover:text-label active:scale-90 transition"
              >
                <SkipBack size={12} weight="fill" />
              </button>
              <button
                type="button"
                title={np.isPlaying ? "Pause" : "Play"}
                onClick={(e) => {
                  e.stopPropagation();
                  void media.toggle();
                }}
                className="pressable flex size-6 items-center justify-center rounded-full bg-white/15 text-label hover:bg-white/25 active:scale-90 transition"
              >
                {np.isPlaying ? <Pause size={12} weight="fill" /> : <Play size={12} weight="fill" className="ml-0.5" />}
              </button>
              <button
                type="button"
                title="Next Track"
                onClick={(e) => {
                  e.stopPropagation();
                  void media.next();
                }}
                className="pressable flex size-6 items-center justify-center rounded-full text-label-2 hover:bg-white/10 hover:text-label active:scale-90 transition"
              >
                <SkipForward size={12} weight="fill" />
              </button>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="weather"
            className="flex min-w-0 flex-1 items-center justify-end gap-1.5 pr-1 select-none"
            initial={{ opacity: 0, filter: "blur(4px)" }}
            animate={{ opacity: 1, filter: "blur(0px)", transition: content.enter }}
            exit={{ opacity: 0, filter: "blur(4px)", transition: content.exit }}
          >
            {weather && forecast && forecast !== "error" ? (
              <>
                <weather.icon size={15} weight="fill" className="shrink-0 text-label" />
                <span className="tabular text-xs font-semibold text-label">
                  {formatTemp(forecast.current.temp)}
                </span>
                <span className="truncate text-[11px] text-label-3 max-w-[70px]">
                  {weather.text}
                </span>
              </>
            ) : (
              <div className="flex items-center gap-1.5 text-caption text-label-3">
                <SunDim size={14} weight="bold" />
                <span className="truncate text-[11px]">{place?.name || comp.name || "Companion"}</span>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
