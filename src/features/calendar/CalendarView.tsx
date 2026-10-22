import { useEffect, useMemo, useState } from "react";
import {
  ArrowClockwise,
  BellSimple,
  BellSimpleSlash,
  CalendarBlank,
  CalendarCheck,
  CaretLeft,
  CaretRight,
  Clock,
  Coffee,
  LinkSimple,
  MapPin,
  SignIn,
  Sparkle,
} from "@phosphor-icons/react";
import { motion } from "motion/react";
import { HeaderActions } from "../../notch/header";
import { settings, updateSettings } from "../../settings/store";
import { CompanionSlot } from "../companion/CompanionSlot";
import { triggerCompanionMood } from "../companion/companionBrain";
import {
  buildMonthEventDots,
  calendarStore,
  filterVisibleEvents,
  fromDateKey,
  getEventsForDateKey,
  getNextPillEvent,
  initCalendarBridge,
  jumpToToday,
  openCalendarAuthWindow,
  openExternalUrl,
  selectCalendarDate,
  shiftCalendarMonth,
  syncCalendar,
  toDateKey,
  type CalendarEventItem,
} from "./calendarStore";
import { locale, t } from "../../i18n";

const WEEKDAYS_SHORT = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];

export function CalendarView() {
  const state = calendarStore.use();
  const s = settings.use();
  const showInPill = s.calendar?.showInPill ?? true;
  const disabledCalendars = s.calendar?.disabledCalendars ?? [];
  const aliases = s.calendar?.calendarAliases ?? {};
  const colors = s.calendar?.calendarColors ?? {};

  const [agendaMode, setAgendaMode] = useState<"day" | "upcoming">("day");
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    void initCalendarBridge();
    const id = window.setInterval(() => setNowMs(Date.now()), 30_000);
    const todayEvs = getEventsForDateKey(state.events, toDateKey(Date.now()));
    if (todayEvs.length === 0) {
      triggerCompanionMood("celebrate", 2200);
    } else if (todayEvs.length >= 3) {
      triggerCompanionMood("studying", 2200);
    } else {
      triggerCompanionMood("curious", 2000);
    }
    return () => window.clearInterval(id);
  }, []);

  const todayKey = useMemo(() => toDateKey(nowMs), [nowMs]);
  const isTodaySelected = state.selectedDateKey === todayKey;

  // Filter events by enabled calendars and apply user aliases & colors
  const visibleEvents = useMemo(
    () => filterVisibleEvents(state.events, disabledCalendars, aliases, colors),
    [state.events, disabledCalendars, aliases, colors]
  );

  const dayEvents = useMemo(
    () => getEventsForDateKey(visibleEvents, state.selectedDateKey),
    [visibleEvents, state.selectedDateKey]
  );

  const upcomingEvents = useMemo(() => {
    return visibleEvents
      .filter((ev) => ev.endMs >= nowMs)
      .sort((a, b) => a.startMs - b.startMs)
      .slice(0, 25);
  }, [visibleEvents, nowMs]);

  const nextPill = useMemo(
    () => getNextPillEvent(visibleEvents, nowMs),
    [visibleEvents, nowMs]
  );

  // Contextual companion reaction on date selection
  useEffect(() => {
    if (dayEvents.length === 0) {
      triggerCompanionMood("celebrate", 2200);
    } else if (dayEvents.length >= 3) {
      triggerCompanionMood("studying", 2200);
    } else {
      triggerCompanionMood("curious", 2000);
    }
  }, [state.selectedDateKey]);

  const monthDots = useMemo(
    () => buildMonthEventDots(visibleEvents, state.viewMonth.year, state.viewMonth.month),
    [visibleEvents, state.viewMonth.year, state.viewMonth.month]
  );

  const gridCells = useMemo(
    () => buildMonthGridCells(state.viewMonth.year, state.viewMonth.month),
    [state.viewMonth.year, state.viewMonth.month]
  );

  const monthTitle = useMemo(() => {
    const d = new Date(state.viewMonth.year, state.viewMonth.month, 1);
    return new Intl.DateTimeFormat(locale(), { month: "short", year: "numeric" }).format(d);
  }, [state.viewMonth.year, state.viewMonth.month]);

  const selectedDateLabel = useMemo(() => {
    const d = fromDateKey(state.selectedDateKey);
    const formatted = new Intl.DateTimeFormat(locale(), {
      weekday: "short",
      day: "numeric",
      month: "short",
    }).format(d);
    return state.selectedDateKey === todayKey ? `${t("Today")} · ${formatted}` : formatted;
  }, [state.selectedDateKey, todayKey]);

  const togglePillDisplay = () => {
    const next = !showInPill;
    updateSettings((prev) => ({
      ...prev,
      calendar: {
        ...(prev.calendar ?? { disabledCalendars: [] }),
        showInPill: next,
      },
    }));
  };

  // Companion status indicator badge
  const companionBadge = useMemo(() => {
    if (nextPill?.isLive) {
      return {
        label: `${nextPill.event.title.slice(0, 14)} (${nextPill.minutesLeft}m left)`,
        icon: Clock,
        tone: "live",
      };
    }
    if (nextPill && nextPill.minutesUntil <= 45) {
      return {
        label: `In ${nextPill.minutesUntil}m: ${nextPill.event.title.slice(0, 13)}`,
        icon: Clock,
        tone: "soon",
      };
    }
    if (dayEvents.length === 0) {
      return {
        label: "Free Day",
        icon: Coffee,
        tone: "free",
      };
    }
    return {
      label: `${dayEvents.length} Event${dayEvents.length === 1 ? "" : "s"}`,
      icon: CalendarCheck,
      tone: "normal",
    };
  }, [nextPill, dayEvents.length]);

  const displayedEvents = agendaMode === "upcoming" ? upcomingEvents : dayEvents;

  return (
    <div className="relative flex h-full flex-col px-4 pb-2">
      {/* Top Header Actions (Injected into Notch Header) */}
      <HeaderActions>
        {/* Google Calendar Connection Status Badge */}
        {state.authenticated ? (
          <span
            className="flex h-6 items-center gap-1.5 rounded-full border border-emerald-500/25 bg-emerald-500/10 px-2.5 text-[10.5px] font-medium text-emerald-300"
            title={state.account ? `Connected as ${state.account}` : "Google Calendar Connected"}
          >
            <span className="size-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="max-w-[110px] truncate">{state.account || "Google Calendar"}</span>
          </span>
        ) : (
          <button
            type="button"
            onClick={() => void openCalendarAuthWindow()}
            className="pressable flex h-6 items-center gap-1 rounded-full border border-[var(--accent,#4285f4)]/40 bg-[var(--accent,#4285f4)]/15 px-2 text-[10.5px] font-semibold text-white hover:brightness-110"
            title="Sign in with your Google account"
          >
            <SignIn size={12} weight="bold" />
            <span>Connect</span>
          </button>
        )}

        {/* 1-Click Peek Pill Display Toggle */}
        <button
          type="button"
          onClick={togglePillDisplay}
          title={
            showInPill
              ? "Showing upcoming events in Mini-Island Peek Pill (Click to hide)"
              : "Hidden from Mini-Island Peek Pill (Click to show)"
          }
          className={`pressable flex h-6 items-center gap-1 rounded-full border px-2 text-[11px] font-medium transition-all ${
            showInPill
              ? "border-[var(--accent,#4285f4)]/40 bg-[var(--accent,#4285f4)]/15 text-label"
              : "border-white/[0.07] bg-fill-1 text-label-3 hover:text-label-2"
          }`}
        >
          {showInPill ? (
            <BellSimple size={12} weight="fill" className="text-[var(--accent,#4285f4)]" />
          ) : (
            <BellSimpleSlash size={12} weight="regular" />
          )}
          <span>{showInPill ? "Pill: On" : "Pill: Off"}</span>
        </button>

        {/* Jump to Today button when inspecting another date/month */}
        {(!isTodaySelected ||
          state.viewMonth.year !== new Date(nowMs).getFullYear() ||
          state.viewMonth.month !== new Date(nowMs).getMonth()) && (
          <button
            type="button"
            onClick={() => {
              jumpToToday();
              const todayEvs = getEventsForDateKey(state.events, toDateKey(Date.now()));
              if (todayEvs.length === 0) {
                triggerCompanionMood("celebrate", 2200);
              } else if (todayEvs.length >= 3) {
                triggerCompanionMood("studying", 2200);
              } else {
                triggerCompanionMood("curious", 2000);
              }
            }}
            className="pressable flex h-6 items-center rounded-full border border-white/[0.08] bg-fill-1 px-2 text-[10.5px] font-semibold text-label-2 hover:bg-fill-2 hover:text-label"
          >
            Today
          </button>
        )}

        {/* Sync / Refresh Button */}
        <button
          type="button"
          onClick={() => void syncCalendar()}
          title="Sync Google Calendar & Subscriptions"
          className="pressable flex size-6 items-center justify-center rounded-full border border-white/[0.08] bg-fill-1 text-label-2 hover:bg-fill-2 hover:text-label"
        >
          <ArrowClockwise
            size={12}
            weight="bold"
            className={state.syncing ? "animate-spin text-[var(--accent,#4285f4)]" : ""}
          />
        </button>
      </HeaderActions>

      {/* Main 3-Zone Calendar Dashboard */}
      <div className="relative flex min-h-0 flex-1 items-stretch gap-2.5 pt-0.5">
        {/* Zone 1: Left Companion Timekeeper Slot */}
        <div className="flex w-[80px] shrink-0 flex-col items-center justify-between py-1">
          <div
            className="flex flex-1 items-center justify-center cursor-pointer"
            onClick={() => {
              const moods: Array<"happy" | "winking" | "tickled" | "petting"> = [
                "happy",
                "winking",
                "tickled",
                "petting",
              ];
              const pick = moods[Math.floor(Math.random() * moods.length)];
              triggerCompanionMood(pick, 1800);
            }}
            title="Poke companion"
          >
            <CompanionSlot variant="side" />
          </div>

          {/* Companion Timekeeper Status Pill */}
          <button
            type="button"
            onClick={() => {
              if (nextPill) {
                selectCalendarDate(toDateKey(nextPill.event.startMs));
                setAgendaMode("day");
                triggerCompanionMood("curious", 2400);
              } else {
                jumpToToday();
                triggerCompanionMood("happy", 2400);
              }
            }}
            title={
              nextPill
                ? `Next: ${nextPill.event.title} (Click to focus)`
                : "Your schedule is clear!"
            }
            className={`pressable flex w-full items-center justify-center gap-1 rounded-full border px-2 py-1 text-[10px] font-semibold transition-all ${
              companionBadge.tone === "live"
                ? "border-red-500/40 bg-red-500/15 text-red-300"
                : companionBadge.tone === "soon"
                  ? "border-amber-400/40 bg-amber-400/15 text-amber-200"
                  : companionBadge.tone === "free"
                    ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-300"
                    : "border-white/[0.08] bg-fill-1 text-label-2 hover:bg-fill-2"
            }`}
          >
            <companionBadge.icon size={11} weight="fill" className="shrink-0" />
            <span className="truncate">{companionBadge.label}</span>
          </button>
        </div>

        {/* Zone 2: Interactive Month Grid */}
        <div className="flex w-[206px] shrink-0 flex-col justify-between rounded-[14px] border border-white/[0.07] bg-fill-1 p-2.5">
          {/* Month Header */}
          <div className="flex items-center justify-between px-0.5 pb-1">
            <span className="text-[12px] font-semibold tracking-tight text-label capitalize">
              {monthTitle}
            </span>
            <div className="flex items-center gap-0.5">
              <button
                type="button"
                onClick={() => {
                  shiftCalendarMonth(-1);
                  triggerCompanionMood("curious", 800);
                }}
                className="pressable flex size-5 items-center justify-center rounded-md text-label-2 hover:bg-fill-2 hover:text-label"
                title="Previous Month"
              >
                <CaretLeft size={12} weight="bold" />
              </button>
              <button
                type="button"
                onClick={() => {
                  shiftCalendarMonth(1);
                  triggerCompanionMood("curious", 800);
                }}
                className="pressable flex size-5 items-center justify-center rounded-md text-label-2 hover:bg-fill-2 hover:text-label"
                title="Next Month"
              >
                <CaretRight size={12} weight="bold" />
              </button>
            </div>
          </div>

          {/* Weekday Labels */}
          <div className="grid grid-cols-7 text-center text-[9.5px] font-medium text-label-3">
            {WEEKDAYS_SHORT.map((wd) => (
              <span key={wd} className="py-0.5">
                {wd}
              </span>
            ))}
          </div>

          {/* 6x7 Day Cells */}
          <div className="grid flex-1 grid-cols-7 grid-rows-6 gap-0.5 pt-0.5">
            {gridCells.map((cell) => {
              const isSelected = cell.dateKey === state.selectedDateKey;
              const isToday = cell.dateKey === todayKey;
              const dots = monthDots.get(cell.dateKey) ?? [];

              return (
                <button
                  key={cell.dateKey}
                  type="button"
                  onClick={() => {
                    selectCalendarDate(cell.dateKey);
                    setAgendaMode("day");
                    const dayEvs = getEventsForDateKey(visibleEvents, cell.dateKey);
                    if (dayEvs.length === 0) {
                      triggerCompanionMood("celebrate", 2200);
                    } else if (dayEvs.length >= 3) {
                      triggerCompanionMood("studying", 2200);
                    } else {
                      triggerCompanionMood("curious", 2000);
                    }
                  }}
                  className={`pressable relative flex flex-col items-center justify-center rounded-[7px] text-[10.5px] tabular transition-all ${
                    isSelected
                      ? "bg-[var(--accent,#4285f4)] font-bold text-white shadow-sm"
                      : isToday
                        ? "border border-[var(--accent,#4285f4)]/65 bg-[var(--accent,#4285f4)]/15 font-semibold text-label"
                        : cell.inMonth
                          ? "text-label hover:bg-fill-2"
                          : "text-label-3/45 hover:bg-fill-1 hover:text-label-3"
                  }`}
                >
                  <span className="leading-none">{cell.dayNumber}</span>
                  {/* Event indicator dots */}
                  {dots.length > 0 && (
                    <div className="mt-0.5 flex items-center gap-0.5">
                      {dots.map((color, idx) => (
                        <span
                          key={idx}
                          className="size-1 rounded-full"
                          style={{
                            backgroundColor: isSelected ? "#ffffff" : color,
                          }}
                        />
                      ))}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Zone 3: Upcoming / Selected Day Events Feed */}
        <div className="flex min-w-0 flex-1 flex-col rounded-[14px] border border-white/[0.07] bg-fill-1 p-2.5">
          {/* Agenda Header + Day / Upcoming Mode Switch */}
          <div className="mb-2 flex items-center justify-between gap-2 border-b border-white/[0.06] pb-1.5">
            <span className="truncate text-[11.5px] font-semibold text-label">
              {agendaMode === "upcoming" ? "Upcoming Schedule" : selectedDateLabel}
            </span>

            <div className="flex shrink-0 items-center rounded-lg bg-black/25 p-0.5 text-[10px] font-medium">
              <button
                type="button"
                onClick={() => {
                  setAgendaMode("day");
                  triggerCompanionMood("curious", 1400);
                }}
                className={`rounded-md px-2 py-0.5 transition-all ${
                  agendaMode === "day"
                    ? "bg-fill-2 font-semibold text-label shadow-xs"
                    : "text-label-3 hover:text-label-2"
                }`}
              >
                Day
              </button>
              <button
                type="button"
                onClick={() => {
                  setAgendaMode("upcoming");
                  triggerCompanionMood("curious", 1400);
                }}
                className={`rounded-md px-2 py-0.5 transition-all ${
                  agendaMode === "upcoming"
                    ? "bg-fill-2 font-semibold text-label shadow-xs"
                    : "text-label-3 hover:text-label-2"
                }`}
              >
                Upcoming
              </button>
            </div>
          </div>

          {/* Events List Body */}
          {!state.authenticated && state.events.length === 0 ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-2 px-3 text-center">
              <CalendarBlank size={24} weight="duotone" className="text-[var(--accent,#4285f4)]" />
              <div className="space-y-0.5">
                <p className="text-xs font-semibold text-label">Connect Google Calendar</p>
                <p className="text-[10.5px] leading-snug text-label-3">
                  Uses your unified Google session from Gemini. Sign in once to sync all events.
                </p>
              </div>
              <button
                type="button"
                onClick={() => void openCalendarAuthWindow()}
                className="pressable mt-0.5 flex items-center gap-1.5 rounded-full bg-[var(--accent,#4285f4)] px-3 py-1 text-[11px] font-semibold text-white shadow-sm hover:brightness-110"
              >
                <SignIn size={13} weight="bold" />
                <span>Sign in with Google</span>
              </button>
            </div>
          ) : displayedEvents.length === 0 ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-1.5 text-center text-label-3">
              <Sparkle size={20} weight="duotone" className="text-emerald-400/80" />
              <p className="text-xs font-medium text-label-2">
                {agendaMode === "upcoming"
                  ? "No upcoming events found"
                  : isTodaySelected
                    ? "Nothing left on your schedule today"
                    : "No events scheduled for this day"}
              </p>
              <p className="text-[10.5px] text-label-3">
                {isTodaySelected ? "Enjoy the free time!" : "Click another day on the grid to inspect."}
              </p>
            </div>
          ) : (
            <div className="flex-1 space-y-1.5 overflow-y-auto pr-1 [scrollbar-width:thin] [scrollbar-color:rgba(255,255,255,0.18)_transparent] [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-white/18 hover:[&::-webkit-scrollbar-thumb]:bg-white/35">
              {displayedEvents.map((ev) => (
                <EventRow
                  key={ev.id}
                  event={ev}
                  nowMs={nowMs}
                  showDatePrefix={agendaMode === "upcoming"}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function EventRow({
  event,
  nowMs,
  showDatePrefix,
}: {
  event: CalendarEventItem;
  nowMs: number;
  showDatePrefix: boolean;
}) {
  const isLive = !event.allDay && event.startMs <= nowMs && event.endMs > nowMs;
  const isPast = event.endMs < nowMs;
  const minsUntil = Math.round((event.startMs - nowMs) / 60_000);

  const timeString = useMemo(() => {
    const startDate = new Date(event.startMs);
    const endDate = new Date(event.endMs);
    const datePrefix = showDatePrefix
      ? new Intl.DateTimeFormat(locale(), { weekday: "short", day: "numeric", month: "short" }).format(
          startDate
        ) + " · "
      : "";

    if (event.allDay) {
      return `${datePrefix}All day`;
    }

    const fmt = new Intl.DateTimeFormat(locale(), {
      hour: "2-digit",
      minute: "2-digit",
    });
    return `${datePrefix}${fmt.format(startDate)} – ${fmt.format(endDate)}`;
  }, [event.startMs, event.endMs, event.allDay, showDatePrefix]);

  const relativeBadge = useMemo(() => {
    if (event.allDay) return null;
    if (isLive) return { text: "Now", cls: "bg-red-500/20 text-red-300 border-red-500/35" };
    if (minsUntil > 0 && minsUntil <= 60) {
      return {
        text: `in ${minsUntil}m`,
        cls: "bg-amber-400/20 text-amber-200 border-amber-400/35",
      };
    }
    if (minsUntil > 60 && minsUntil <= 360) {
      const hrs = Math.floor(minsUntil / 60);
      const remMins = minsUntil % 60;
      return {
        text: `in ${hrs}h ${remMins > 0 ? `${remMins}m` : ""}`,
        cls: "bg-blue-500/15 text-blue-300 border-blue-500/30",
      };
    }
    return null;
  }, [event.allDay, isLive, minsUntil]);

  return (
    <motion.div
      initial={{ opacity: 0, translateY: 4 }}
      animate={{ opacity: 1, translateY: 0 }}
      transition={{ duration: 0.12 }}
      onClick={() => triggerCompanionMood("winking", 1500)}
      className={`group relative flex cursor-pointer items-center gap-2 rounded-[10px] border px-2.5 py-1.5 transition-colors ${
        isLive
          ? "border-[var(--accent,#4285f4)]/40 bg-[var(--accent,#4285f4)]/12"
          : isPast
            ? "border-white/[0.04] bg-white/[0.02] opacity-55"
            : "border-white/[0.06] bg-white/[0.04] hover:bg-white/[0.07]"
      }`}
    >
      {/* Left Color Bar */}
      <span
        className="w-1 self-stretch rounded-full shrink-0"
        style={{ backgroundColor: event.color || "#4285f4" }}
      />

      {/* Event Info */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-1.5">
          <span className="truncate text-[11.5px] font-semibold text-label">
            {event.title}
          </span>
          {relativeBadge && (
            <span
              className={`shrink-0 rounded-full border px-1.5 py-0.2 text-[9.5px] font-semibold tabular ${relativeBadge.cls}`}
            >
              {relativeBadge.text}
            </span>
          )}
        </div>

        <div className="mt-0.5 flex items-center gap-2 text-[10px] text-label-3">
          <span className="tabular truncate">{timeString}</span>
          {event.calendarName && event.calendarName !== "Calendar" && (
            <span className="flex min-w-0 items-center gap-1 truncate text-[9px] opacity-75">
              <span>·</span>
              <span className="truncate">{event.calendarName}</span>
            </span>
          )}
          {event.location && (
            <span className="flex min-w-0 items-center gap-0.5 truncate">
              <MapPin size={10} weight="fill" className="shrink-0" />
              <span className="truncate">{event.location}</span>
            </span>
          )}
        </div>
      </div>

      {/* 1-Click Event Link Button */}
      {event.meetUrl && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            triggerCompanionMood("vibing", 1500);
            void openExternalUrl(event.meetUrl!);
          }}
          title={event.meetUrl}
          className="pressable flex shrink-0 items-center gap-1 rounded-full border border-[var(--accent,#4285f4)]/35 bg-[var(--accent,#4285f4)]/15 px-2 py-0.5 text-[10px] font-semibold text-white shadow-xs hover:bg-[var(--accent,#4285f4)]/25 hover:border-[var(--accent,#4285f4)]/50 transition-colors"
        >
          <LinkSimple size={11} weight="bold" />
          <span>Link</span>
        </button>
      )}
    </motion.div>
  );
}

interface GridCell {
  dateKey: string;
  dayNumber: number;
  inMonth: boolean;
}

/**
 * Generates 42 cells (6 rows × 7 columns, Monday-first) for the given year & month (0..11).
 */
function buildMonthGridCells(year: number, month: number): GridCell[] {
  const firstOfMonth = new Date(year, month, 1);
  // Convert JS Sunday=0..Saturday=6 into Monday=0..Sunday=6
  const startOffset = (firstOfMonth.getDay() + 6) % 7;
  const cursor = new Date(year, month, 1 - startOffset);

  const cells: GridCell[] = [];
  for (let i = 0; i < 42; i++) {
    cells.push({
      dateKey: toDateKey(cursor),
      dayNumber: cursor.getDate(),
      inMonth: cursor.getMonth() === month,
    });
    cursor.setDate(cursor.getDate() + 1);
  }
  return cells;
}
