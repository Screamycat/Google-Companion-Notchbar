import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "motion/react";
import {
  ArrowClockwise,
  Bluetooth,
  BluetoothConnected,
  BluetoothSlash,
  CaretDown,
  DeviceMobile,
  GearSix,
  Headphones,
  Keyboard,
  LockSimple,
  Moon,
  MoonStars,
  MouseSimple,
  MusicNoteSimple,
  SpeakerHigh,
  SpeakerLow,
  SpeakerNone,
  SpeakerSimpleSlash,
  SunDim,
} from "@phosphor-icons/react";
import { content, popover, springs } from "../../design/motion";
import { HeaderActions, HeaderButton } from "../../notch/header";
import { navigate } from "../../notch/nav";
import { useNowPlaying } from "../../platform/media";
import { bluetooth, systemControls, type BtState, type FocusState, type VolumeState } from "../../platform/services";
import { hitExtra } from "../../platform/native";
import { Equalizer } from "../now-playing/Equalizer";
import { ARTWORK_LAYOUT_ID } from "../now-playing/NowPlayingView";
import { describe, useForecast } from "../weather/store";
import { settings } from "../../settings/store";
import { formatTemp, formatTimeParts } from "../../lib/format";
import { CompanionSlot } from "../companion/CompanionSlot";
import { locale, t, tBackend } from "../../i18n";

/**
 * Modular 3-column Overview layout matching the design sketch:
 *
 *   ┌───────────────┐       ╭─────────╮       ┌───────────────┐
 *   │  Clock & Date │       │  ◠   ◠  │       │    Weather    │
 *   │ ───────────── │       │    ◡    │       │ ───────────── │
 *   │  🔊 Volume    │       ╰─────────╯       │  🎵 Now Play  │
 *   │  ☀ Brightness │    Center Companion     │  ᛒ Bluetooth  │
 *   └───────────────┘                         └───────────────┘
 *
 * Left and right widgets are modular so they can be rearranged at any time.
 */
export function OverviewView() {
  return (
    <div className="flex h-full flex-col justify-between px-4 pt-1 pb-2">
      <HeaderActions>
        <HeaderButton label={t("Sperren")} onClick={() => void systemControls.lock()}>
          <LockSimple size={14} weight="bold" />
        </HeaderButton>
        <HeaderButton label={t("Energie sparen")} onClick={() => void systemControls.sleep()}>
          <MoonStars size={14} weight="bold" />
        </HeaderButton>
      </HeaderActions>

      <div className="grid h-full grid-cols-[1fr_auto_1fr] items-center gap-3.5">
        {/* Left Modular Column */}
        <div className="flex h-full min-w-0 flex-col justify-between gap-2 py-0.5">
          <ClockWidget />
          <div className="flex flex-col gap-2">
            <VolumeTile />
            <BrightnessTile />
          </div>
        </div>

        {/* Center Companion Space */}
        <div className="flex flex-col items-center justify-center px-1">
          <CompanionSlot variant="overview" />
        </div>

        {/* Right Modular Column */}
        <div className="flex h-full min-w-0 flex-col justify-between gap-2 py-0.5">
          <WeatherWidget />
          <div className="flex flex-col gap-2">
            <NowPlayingMiniTile />
            <div className="flex items-center gap-1.5">
              <div className="min-w-0 flex-1">
                <BluetoothTile />
              </div>
              <FocusButton />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function useNow(): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  return now;
}

function ClockWidget() {
  const now = useNow();
  const { time, period } = formatTimeParts(now);
  const date = new Intl.DateTimeFormat(locale(), { weekday: "short", day: "numeric", month: "short" }).format(now);

  return (
    <div className="flex flex-col justify-center rounded-[12px] bg-fill-1 px-3 py-2">
      <div className="tabular text-[26px] leading-none font-semibold tracking-[-0.03em] text-label">
        {time}
        {period && <span className="ml-1 text-footnote font-semibold tracking-normal text-label-3">{period}</span>}
      </div>
      <div className="mt-1 truncate text-caption text-label-3">{date}</div>
    </div>
  );
}

function WeatherWidget() {
  const forecast = useForecast();
  const place = settings.use().weather;
  const weather = forecast && forecast !== "error" ? describe(forecast.current.code, forecast.current.day) : null;

  return (
    <div className="flex flex-col items-end justify-center rounded-[12px] bg-fill-1 px-3 py-2 text-right">
      <AnimatePresence mode="popLayout" initial={false}>
        {weather && forecast && forecast !== "error" ? (
          <motion.div
            key="w"
            className="flex items-center gap-1.5"
            initial={{ opacity: 0, filter: "blur(4px)" }}
            animate={{ opacity: 1, filter: "blur(0px)", transition: content.enter }}
          >
            <weather.icon size={20} weight="fill" className="text-label" />
            <span className="tabular text-[22px] leading-none font-semibold tracking-[-0.02em] text-label">
              {formatTemp(forecast.current.temp)}
            </span>
          </motion.div>
        ) : (
          <motion.div key="s" className="h-[22px] w-16 rounded-[6px] bg-fill-2" exit={{ opacity: 0, transition: content.exit }} />
        )}
      </AnimatePresence>
      <div className="mt-1 max-w-full truncate text-caption text-label-3">
        {place ? `${place.name}${weather ? ` · ${weather.text}` : ""}` : t("Ort wird erkannt …")}
      </div>
    </div>
  );
}

function NowPlayingMiniTile() {
  const np = useNowPlaying();

  let item: { key: string; icon: ReactNode; title: string; detail: string; trailing?: ReactNode } | null = null;
  if (np) {
    item = {
      key: "media",
      icon: np.artwork ? (
        <motion.img
          layoutId={ARTWORK_LAYOUT_ID}
          transition={springs.morph}
          src={np.artwork}
          alt=""
          draggable={false}
          className="size-6 rounded-[6px] object-cover"
        />
      ) : (
        <MusicNoteSimple size={16} weight="fill" className="text-label-2" />
      ),
      title: np.title,
      detail: np.artist,
      trailing: <Equalizer playing={np.isPlaying} />,
    };
  }

  return (
    <div className="relative h-9 overflow-hidden rounded-[12px] bg-fill-1">
      <AnimatePresence mode="popLayout" initial={false}>
        {item ? (
          <motion.button
            key={item.key}
            onClick={() => navigate("media")}
            className="pressable pressable-wide pressable-fill absolute inset-0 flex items-center gap-2 px-2.5 text-left"
            initial={{ opacity: 0, filter: "blur(4px)" }}
            animate={{ opacity: 1, filter: "blur(0px)", transition: content.enter }}
            exit={{ opacity: 0, filter: "blur(4px)", transition: content.exit }}
          >
            <span className="flex size-6 shrink-0 items-center justify-center">{item.icon}</span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-caption font-medium text-label">{item.title}</span>
              <span className="block truncate text-[10px] leading-tight text-label-3">{item.detail}</span>
            </span>
            {item.trailing && <span className="shrink-0 pr-0.5">{item.trailing}</span>}
          </motion.button>
        ) : (
          <motion.button
            key="idle"
            onClick={() => navigate("media")}
            className="pressable absolute inset-0 flex items-center justify-center gap-1.5 text-caption text-label-3 hover:text-label-2"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1, transition: content.enter }}
            exit={{ opacity: 0, transition: content.exit }}
          >
            <MusicNoteSimple size={13} weight="bold" />
            <span className="truncate">{t("Gerade läuft nichts")}</span>
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
}

function FocusButton() {
  const [focus, setFocus] = useState<FocusState | null>(null);
  useEffect(() => {
    const load = () => void systemControls.focus().then(setFocus).catch(() => setFocus(null));
    load();
    const id = setInterval(load, 2000);
    return () => clearInterval(id);
  }, []);
  const active = !!focus?.active;
  const label = focus?.kind === "dnd" ? t("Nicht stören") : t("Fokus");

  return (
    <button
      aria-pressed={active}
      title={label}
      disabled={!focus}
      onClick={() => {
        setFocus((f) => f && { ...f, active: !active });
        void systemControls.setFocus(!active).then(setFocus).catch(() => systemControls.focus().then(setFocus));
      }}
      className={`pressable flex size-9 shrink-0 items-center justify-center rounded-[12px] transition-colors duration-200 disabled:opacity-40 ${
        active ? "bg-label text-black" : "bg-fill-1 text-label-2 hover:text-label"
      }`}
    >
      <Moon size={15} weight="fill" />
    </button>
  );
}

function VolumeTile() {
  const [vol, setVol] = useState<VolumeState | null>(null);
  const dragging = useRef(false);
  const track = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const load = () => !dragging.current && void systemControls.volume().then(setVol).catch(() => {});
    load();
    const id = setInterval(load, 1000);
    return () => clearInterval(id);
  }, []);

  const level = vol ? (vol.muted ? 0 : vol.level) : 0;
  const set = (clientX: number) => {
    const r = track.current!.getBoundingClientRect();
    const l = Math.round(Math.min(1, Math.max(0, (clientX - r.left) / r.width)) * 100) / 100;
    setVol({ level: l, muted: false });
    void systemControls.setVolume({ level: l });
  };
  const Icon = vol?.muted || level === 0 ? SpeakerSimpleSlash : level < 0.34 ? SpeakerNone : level < 0.67 ? SpeakerLow : SpeakerHigh;

  return (
    <div className="flex h-9 min-w-0 items-center gap-1.5 rounded-[12px] bg-fill-1 pr-2.5 pl-1.5">
      <button
        aria-label={vol?.muted ? t("Stummschaltung aufheben") : t("Stumm")}
        disabled={!vol}
        onClick={() => vol && void systemControls.setVolume({ muted: !vol.muted }).then(setVol)}
        className={`pressable flex size-6 shrink-0 items-center justify-center rounded-full ${vol?.muted ? "text-red" : "text-label-2 hover:text-label"}`}
      >
        <Icon size={14} weight="fill" />
      </button>
      <div
        ref={track}
        role="slider"
        tabIndex={0}
        aria-label={t("Lautstärke")}
        aria-valuenow={Math.round(level * 100)}
        aria-valuemin={0}
        aria-valuemax={100}
        className="relative h-5 min-w-0 flex-1 cursor-pointer touch-none overflow-hidden rounded-full bg-fill-2 outline-none"
        onPointerDown={(e) => {
          if (!vol) return;
          dragging.current = true;
          e.currentTarget.setPointerCapture(e.pointerId);
          set(e.clientX);
        }}
        onPointerMove={(e) => e.currentTarget.hasPointerCapture(e.pointerId) && set(e.clientX)}
        onPointerUp={() => (dragging.current = false)}
        onPointerCancel={() => (dragging.current = false)}
        onWheel={(e) => {
          if (!vol) return;
          const l = Math.min(1, Math.max(0, level + (e.deltaY < 0 ? 0.02 : -0.02)));
          setVol({ level: l, muted: false });
          void systemControls.setVolume({ level: l });
        }}
      >
        <motion.div
          className="absolute inset-0 origin-left rounded-full bg-label"
          initial={false}
          animate={{ transform: `scaleX(${level})` }}
          transition={dragging.current ? { duration: 0 } : springs.snappy}
        />
      </div>
      <span className="tabular w-7 shrink-0 text-right text-caption font-semibold text-label-2">{vol ? Math.round(level * 100) : "–"}</span>
    </div>
  );
}

function BrightnessTile() {
  const [level, setLevel] = useState<number | null>(null);
  const dragging = useRef(false);
  const track = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const load = () => !dragging.current && void systemControls.brightness().then((b) => setLevel(b.level)).catch(() => {});
    load();
    const id = setInterval(load, 1000);
    return () => clearInterval(id);
  }, []);

  const set = (clientX: number) => {
    const r = track.current!.getBoundingClientRect();
    const l = Math.round(Math.min(1, Math.max(0, (clientX - r.left) / r.width)) * 100) / 100;
    setLevel(l);
    void systemControls.setBrightness(l).then((b) => setLevel(b.level));
  };

  return (
    <div className="flex h-9 min-w-0 items-center gap-1.5 rounded-[12px] bg-fill-1 pr-2.5 pl-1.5">
      <span className="flex size-6 shrink-0 items-center justify-center text-label-2">
        <SunDim size={14} weight="fill" />
      </span>
      <div
        ref={track}
        role="slider"
        tabIndex={0}
        aria-label={t("Helligkeit")}
        aria-valuenow={level === null ? undefined : Math.round(level * 100)}
        aria-valuemin={0}
        aria-valuemax={100}
        className="relative h-5 min-w-0 flex-1 cursor-pointer touch-none overflow-hidden rounded-full bg-fill-2 outline-none"
        onPointerDown={(e) => {
          if (level === null) return;
          dragging.current = true;
          e.currentTarget.setPointerCapture(e.pointerId);
          set(e.clientX);
        }}
        onPointerMove={(e) => e.currentTarget.hasPointerCapture(e.pointerId) && set(e.clientX)}
        onPointerUp={() => (dragging.current = false)}
        onPointerCancel={() => (dragging.current = false)}
      >
        <motion.div
          className="absolute inset-0 origin-left rounded-full bg-label"
          initial={false}
          animate={{ transform: `scaleX(${level ?? 0})` }}
          transition={dragging.current ? { duration: 0 } : springs.snappy}
        />
      </div>
      <span className="tabular w-7 shrink-0 text-right text-caption font-semibold text-label-2">{level === null ? "–" : Math.round(level * 100)}</span>
    </div>
  );
}

function BtIcon({ cod }: { cod: number }) {
  const major = (cod >> 8) & 0x1f;
  if (major === 0x04) return <Headphones size={16} weight="fill" />;
  if (major === 0x02) return <DeviceMobile size={16} weight="bold" />;
  if (major === 0x05) return ((cod >> 2) & 0x3f) === 0x20 ? <MouseSimple size={16} weight="fill" /> : <Keyboard size={16} weight="bold" />;
  return <Bluetooth size={16} weight="bold" />;
}

function BluetoothTile() {
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<BtState | null>(null);
  const [connecting, setConnecting] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ left: number; top: number; width: number; maxHeight: number } | null>(null);

  useEffect(() => {
    let alive = true;
    const load = () => {
      void bluetooth
        .list()
        .then((s) => {
          if (alive) {
            setState(s);
            setError(null);
          }
        })
        .catch(() => {
          if (alive) setState(null);
        });
    };
    load();
    if (!open) return () => void (alive = false);
    const id = setInterval(load, 5000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [open]);

  useLayoutEffect(() => {
    if (!open) return;
    const trigger = ref.current?.getBoundingClientRect();
    if (!trigger) return;
    const maxY =
      Math.min(ref.current?.closest("[data-notch-hit]")?.getBoundingClientRect().bottom ?? window.innerHeight, window.innerHeight) - 8;
    setPos({
      left: trigger.left,
      width: Math.max(200, trigger.width),
      top: trigger.bottom + 6,
      maxHeight: Math.max(120, Math.min(264, maxY - trigger.bottom - 6)),
    });
  }, [open]);

  useLayoutEffect(() => {
    if (!open || !pos) {
      hitExtra.set(null);
      return;
    }
    const m = menu.current?.getBoundingClientRect();
    const r =
      m && m.height > 0
        ? { x: m.left, y: m.top, w: m.width, h: m.height }
        : { x: pos.left, y: pos.top, w: pos.width, h: pos.maxHeight };
    hitExtra.set({ x: r.x - 4, y: r.y - 4, w: r.w + 8, h: r.h + 8 });
    return () => void hitExtra.set(null);
  }, [open, pos, state]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node;
      if (!ref.current?.contains(t) && !menu.current?.contains(t)) setOpen(false);
    };
    const close = () => setOpen(false);
    window.addEventListener("pointerdown", onDown);
    window.addEventListener("resize", close);
    return () => {
      window.removeEventListener("pointerdown", onDown);
      window.removeEventListener("resize", close);
    };
  }, [open]);

  const host = ref.current?.closest("[data-notch-hit]") ?? document.body;
  const devices = state?.devices ?? [];
  const connected = devices.find((d) => d.connected);

  const alive = useRef(true);
  useEffect(() => () => void (alive.current = false), []);

  const connect = (address: number) => {
    if (connecting !== null) return;
    const started = Date.now();
    setConnecting(address);
    setError(null);
    void (async () => {
      try {
        let s = await bluetooth.connect(address);
        for (let i = 0; i < 5; i++) {
          if (!alive.current) return;
          if (s.devices.some((x) => x.address === address && x.connected)) break;
          await new Promise((r) => setTimeout(r, 2000));
          if (!alive.current) return;
          s = await bluetooth.list();
        }
        const wait = 1200 - (Date.now() - started);
        if (wait > 0) await new Promise((r) => setTimeout(r, wait));
        if (!alive.current) return;
        setState(s);
        if (!s.devices.some((x) => x.address === address && x.connected)) {
          setError(t("Verbindung fehlgeschlagen"));
        }
        setConnecting(null);
      } catch (e) {
        const wait = 1200 - (Date.now() - started);
        if (wait > 0) await new Promise((r) => setTimeout(r, wait));
        if (!alive.current) return;
        setConnecting(null);
        setError(tBackend(typeof e === "string" ? e : t("Verbindung fehlgeschlagen")));
      }
    })();
  };

  const sub =
    state === null
      ? "–"
      : !state.radio
        ? t("Nicht verfügbar")
        : connected
          ? connected.name
          : devices.length === 0
            ? t("Keine gekoppelten Geräte")
            : t("{n} Geräte", { n: devices.length });

  return (
    <div ref={ref} className="relative">
      <button
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="pressable flex h-9 w-full items-center gap-2 rounded-[12px] bg-fill-1 px-2.5 text-left"
      >
        <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-fill-2 text-label-2">
          {state && !state.radio ? (
            <BluetoothSlash size={12} weight="bold" />
          ) : connected ? (
            <BluetoothConnected size={12} weight="fill" />
          ) : (
            <Bluetooth size={12} weight="bold" />
          )}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-caption font-semibold text-label">{ sub }</span>
        </span>
        <motion.span animate={{ rotate: open ? 180 : 0 }} transition={springs.snappy} className="text-label-3">
          <CaretDown size={11} weight="bold" />
        </motion.span>
      </button>
      {createPortal(
        <AnimatePresence>
          {open && pos && (
            <motion.div
              ref={menu}
              className="pointer-events-auto fixed z-[60] overflow-y-auto rounded-[14px] bg-elevated p-1.5 shadow-[0_10px_30px_rgb(0_0_0/0.6)] ring-1 ring-separator [scrollbar-width:none]"
              style={{ left: pos.left, top: pos.top, width: pos.width, maxHeight: pos.maxHeight }}
              initial={{ opacity: 0, transform: "scale(0.98) translateY(-4px)" }}
              animate={{ opacity: 1, transform: "scale(1) translateY(0px)", transition: popover.enter }}
              exit={{ opacity: 0, transform: "scale(0.98)", transition: popover.exit }}
            >
              {state === null ? (
                <div className="flex flex-col gap-1.5 p-1">
                  <div className="h-12 rounded-[10px] bg-fill-1" />
                  <div className="h-12 rounded-[10px] bg-fill-1" />
                </div>
              ) : devices.length === 0 ? (
                <div className="px-2 py-3 text-center text-footnote text-label-3">
                  {state.radio ? t("Keine gekoppelten Geräte") : t("Nicht verfügbar")}
                </div>
              ) : (
                devices.map((d) => (
                  <div key={d.address} className="flex h-12 items-center gap-2.5 rounded-[10px] px-2">
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-fill-2 text-label-2">
                      <BtIcon cod={d.class} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-footnote font-semibold text-label">{d.name}</span>
                      <span className="block text-caption">
                        {connecting === d.address ? (
                          <span className="text-link">{t("Verbinde …")}</span>
                        ) : d.connected ? (
                          <span className="text-green">{t("Verbunden")}</span>
                        ) : (
                          <span className="text-label-3">{t("Nicht verbunden")}</span>
                        )}
                      </span>
                    </span>
                    {connecting === d.address ? (
                      <motion.span
                        animate={{ rotate: 360 }}
                        transition={{ duration: 0.9, ease: "linear", repeat: Infinity }}
                        className="flex size-[18px] shrink-0 items-center justify-center rounded-full border-2 border-fill-2 border-t-label-2"
                        role="status"
                        aria-label={t("Verbinde …")}
                      />
                    ) : (
                      !d.connected && (
                        <button
                          disabled={connecting !== null}
                          onClick={() => connect(d.address)}
                          className="pressable flex h-7 shrink-0 items-center gap-1.5 rounded-[8px] px-2 text-footnote font-medium text-label disabled:opacity-40"
                        >
                          {t("Verbinden")}
                        </button>
                      )
                    )}
                  </div>
                ))
              )}
              {error && <div className="px-2 pt-1 pb-0.5 text-caption text-red">{error}</div>}
              <div className="mt-1 flex items-center justify-between border-t border-separator px-1 pt-1">
                <button
                  onClick={() => void bluetooth.settings()}
                  className="pressable flex h-7 items-center gap-1.5 rounded-[8px] px-2 text-footnote text-label-2 hover:text-label"
                >
                  <GearSix size={13} weight="bold" />
                  {t("Bluetooth-Einstellungen")}
                </button>
                <button
                  aria-label={t("Aktualisieren")}
                  disabled={connecting !== null}
                  onClick={() => {
                    setError(null);
                    void bluetooth
                      .list()
                      .then((s) => {
                        setState(s);
                        setError(null);
                      })
                      .catch(() => {});
                  }}
                  className="pressable flex size-7 items-center justify-center rounded-[8px] text-label-2 hover:text-label disabled:opacity-40"
                >
                  <ArrowClockwise size={13} weight="bold" />
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>,
        host,
      )}
    </div>
  );
}
