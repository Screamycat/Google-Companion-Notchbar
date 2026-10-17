import { Fragment, useEffect, useLayoutEffect, useRef, useState, type RefObject } from "react";
import { AnimatePresence, LayoutGroup, motion, type Transition } from "motion/react";
import { PushPin, Selection } from "@phosphor-icons/react";
import { content, springs } from "../design/motion";
import { useNowPlaying } from "../platform/media";
import { isNative, hitExtra, keyboardFocus, onNativeBlur, onNativeHover, onShortcut, onTrayOpen, setHitRect, setMemoryLow } from "../platform/native";
import { FOCUS_CLICKS, focusMode, setFocusMode } from "./focus";
import { useDragToMove } from "./drag";
import { DOCK_HEIGHT, HEADER_HEIGHT, geometry, stageGeometry, type NotchGeometry } from "./geometry";
import { HeaderButton, headerSlot } from "./header";
import { sizeOverride } from "./size";
import { NotchShape } from "./NotchShape";
import { BackgroundEffects } from "./BackgroundEffects";
import { settings, type NotchTuning } from "../settings/store";
import { useUnseen } from "../lib/changelog";
import { nav, navigate } from "./nav";
import { update } from "../lib/update";
import { findTab, settingsTab, tabs, type NotchTab } from "./tabs";
import { holdOpen, pinned, togglePin, useNotchState, type NotchStatus } from "./useNotchState";
import { CompanionSlot } from "../features/companion/CompanionSlot";
import { t } from "../i18n";

/** Closed this long → lower WebView2's memory target. */
const MEMORY_LOW_AFTER_MS = 20_000;

export function Notch() {
  const { status, open, close, dismiss, toggle, onPointerEnter, onPointerLeave } = useNotchState();
  const focus = focusMode.use();
  const { tools: toolSettings, display: displaySettings, appearance, notch: notchTuning } = settings.use();
  const line = focus && displaySettings.focusStyle === "line";

  const enabledTabs = toolSettings
    .filter((t) => t.enabled)
    .map((t) => findTab(t.id))
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
  // while allowing Settings or expanded Mixer to use their height when needed.
  const baseSize =
    tab.id === settingsTab.id
      ? { w: Math.max(notchTuning.openW, settingsTab.size.w), h: Math.max(notchTuning.openH, settingsTab.size.h) }
      : { w: notchTuning.openW, h: notchTuning.openH };
  const size = override?.tabId === tab.id ? { w: baseSize.w, h: override.h } : baseSize;

  const stages = stageGeometry(notchTuning, size);
  const shape = line
    ? geometry.line
    : status === "open"
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
  const isOpen = status === "open";
  const chromeBg = isOpen ? appearance.expanded : appearance.resting;
  const chromeLight = luminance(chromeBg) > 0.55;
  const ink = chromeLight ? "0 0 0" : "255 255 255";
  const tone = {
    solid: chromeBg,
    wash: !isOpen
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

  useEffect(() => {
    if (focus) close();
  }, [focus, close]);

  const onClick = (e: React.MouseEvent) => {
    if (drag.moved()) return;
    if (e.detail >= FOCUS_CLICKS && !isInteractive(e.target)) return setFocusMode(!focus);
    if (!focus && status !== "open") open();
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
          opacity: focus && !line ? 0.5 : 1,
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
          onPointerDown={focus ? undefined : drag.onPointerDown}
          onPointerEnter={isNative || focus ? undefined : onPointerEnter}
          onPointerLeave={isNative || focus ? undefined : onPointerLeave}
          onClick={onClick}
        >
          <NotchShape geometry={shaped} transition={transition} elevated={status !== "closed"} tone={tone}>
            {/* Stage 2 (Peek): Companion peeking out in the center of the small island */}
            <AnimatePresence>
              {status === "peek" && !line && (
                <motion.div
                  key="peek-companion"
                  className="absolute inset-0 flex items-center justify-center"
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0, transition: { duration: 0.18 } }}
                  exit={{ opacity: 0, y: -6, transition: { duration: 0.12 } }}
                >
                  <CompanionSlot variant="peek" />
                </motion.div>
              )}
            </AnimatePresence>

            {/* Stage 3 (Open Dropdown): Header + Active Tab + Categorized Bottom Dock */}
            <AnimatePresence>
              {status === "open" && (
                <motion.div
                  key="open"
                  className="absolute top-0 left-1/2 flex flex-col"
                  style={{ width: size.w, height: size.h, marginLeft: -size.w / 2 }}
                  onWheel={onWheel}
                  initial={{ opacity: 0, transform: "translateY(-6px)", filter: "blur(6px)" }}
                  animate={{ opacity: 1, transform: "translateY(0px)", filter: "blur(0px)", transition: content.enter }}
                  exit={{ opacity: 0, transform: "translateY(-4px)", filter: "blur(4px)", transition: content.exit }}
                >
                  {appearance.effect !== "none" && (
                    <BackgroundEffects effect={appearance.effect} playing={np?.isPlaying ?? false} radius={shaped.r} />
                  )}
                  <Header title={t(tab.label)} onDragStart={drag.onPointerDown} />
                  <div className="relative min-h-0 flex-1 overflow-clip">
                    <AnimatePresence mode="popLayout" initial={false}>
                      <motion.div
                        key={tab.id}
                        className="absolute inset-0"
                        initial={{ opacity: 0, filter: "blur(4px)" }}
                        animate={{ opacity: 1, filter: "blur(0px)", transition: content.enter }}
                        exit={{ opacity: 0, filter: "blur(4px)", transition: content.exit }}
                      >
                        <tab.View />
                      </motion.div>
                    </AnimatePresence>
                  </div>
                  <Dock tabs={dockTabs} activeId={tab.id} />
                </motion.div>
              )}
            </AnimatePresence>
          </NotchShape>
        </div>
      </div>
    </LayoutGroup>
  );
}

/** Header: tool title on the left, actions + pin on the right. */
function Header({ title, onDragStart }: { title: string; onDragStart: (e: React.PointerEvent) => void }) {
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
        <HeaderButton label={t("Fokus-Modus (3× klicken zum Beenden)")} onClick={() => setFocusMode(true)}>
          <Selection size={14} weight="bold" />
        </HeaderButton>
        <HeaderButton label={isPinned ? t("Lösen") : t("Offen halten")} active={isPinned} onClick={togglePin}>
          <PushPin size={14} weight={isPinned ? "fill" : "bold"} />
        </HeaderButton>
      </div>
    </div>
  );
}

/**
 * Categorized bottom dock:
 * Renders tabs in order, placing a vertical `|` separator whenever `tab.category` changes
 * (e.g. `[Overview] [Music] | [Settings]`).
 */
function Dock({ tabs, activeId }: { tabs: NotchTab[]; activeId: string }) {
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
