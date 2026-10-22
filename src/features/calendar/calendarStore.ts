import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { createStore } from "../../lib/store";
import { isNative } from "../../platform/native";
import { settings, updateSettings, type CalendarSubscription } from "../../settings/store";
import { triggerCompanionMood } from "../companion/companionBrain";

export interface CalendarEventItem {
  id: string;
  title: string;
  startMs: number;
  endMs: number;
  allDay: boolean;
  calendarName: string;
  color: string;
  location?: string | null;
  meetUrl?: string | null;
  description?: string | null;
}

export interface CalendarStatusPayload {
  initialized: boolean;
  authenticated: boolean;
  syncing: boolean;
  account: string | null;
  lastSyncedMs: number | null;
  error: string | null;
}

export interface CalendarStoreState extends CalendarStatusPayload {
  events: CalendarEventItem[];
  /** Currently selected date in local `YYYY-MM-DD` format */
  selectedDateKey: string;
  /** Currently displayed month in the grid (`month` is 0..11) */
  viewMonth: { year: number; month: number };
}

export interface CalendarListItem {
  name: string;
  displayName: string;
  color: string;
  count: number;
  enabled: boolean;
  isSubscription?: boolean;
  subscriptionId?: string;
}

export function toDateKey(d: Date | number): string {
  const date = typeof d === "number" ? new Date(d) : d;
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function fromDateKey(key: string): Date {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

const nowInitial = new Date();

export const calendarStore = createStore<CalendarStoreState>({
  initialized: false,
  authenticated: false,
  syncing: false,
  account: null,
  lastSyncedMs: null,
  error: null,
  events: [],
  selectedDateKey: toDateKey(nowInitial),
  viewMonth: { year: nowInitial.getFullYear(), month: nowInitial.getMonth() },
});

type IncomingCalendarEvent =
  | ({ type: "status" } & CalendarStatusPayload)
  | { type: "events"; events: CalendarEventItem[] };

let listenerAttached = false;
let initTriggered = false;

function ensureListener() {
  if (listenerAttached || !isNative) return;
  listenerAttached = true;
  void listen<IncomingCalendarEvent>("notch://calendar", (event) => {
    const p = event.payload;
    if (p.type === "status") {
      calendarStore.set((prev) => ({
        ...prev,
        initialized: p.initialized,
        authenticated: p.authenticated,
        syncing: p.syncing,
        account: p.account ?? prev.account,
        lastSyncedMs: p.lastSyncedMs ?? prev.lastSyncedMs,
        error: p.error ?? null,
      }));
    } else if (p.type === "events") {
      // Merge incoming events with any local subscription events
      calendarStore.set((prev) => {
        const incoming = p.events ?? [];
        return {
          ...prev,
          events: mergeEvents(incoming, getSubscriptionEvents(prev.events)),
          syncing: false,
        };
      });
    }
  });
}

function getSubscriptionEvents(allEvents: CalendarEventItem[]): CalendarEventItem[] {
  const subIds = new Set((settings.get().calendar?.subscriptions ?? []).map((s) => s.id));
  return allEvents.filter((e) => e.id.startsWith("sub-") && subIds.has(e.id.split("-")[1]));
}

function mergeEvents(primary: CalendarEventItem[], secondary: CalendarEventItem[]): CalendarEventItem[] {
  const seen = new Set<string>();
  const merged: CalendarEventItem[] = [];

  for (const ev of [...primary, ...secondary]) {
    const key = `${ev.title}|${ev.startMs}|${ev.calendarName}`;
    if (!seen.has(key)) {
      seen.add(key);
      merged.push(ev);
    }
  }

  return merged.sort((a, b) => a.startMs - b.startMs);
}

export async function initCalendarBridge(): Promise<void> {
  ensureListener();
  if (!isNative) return;
  if (initTriggered && calendarStore.get().initialized) return;
  initTriggered = true;

  try {
    const cached = await invoke<CalendarEventItem[]>("calendar_get_events");
    if (cached && cached.length > 0) {
      calendarStore.set((prev) => ({ ...prev, events: cached }));
    }
    const status = await invoke<CalendarStatusPayload>("calendar_init");
    calendarStore.set((prev) => ({
      ...prev,
      ...status,
      account: status.account ?? prev.account,
    }));

    // Also sync all URL subscriptions on startup
    void syncAllSubscriptions();
  } catch {
    // Ignore init error
  }
}

export async function syncCalendar(): Promise<void> {
  ensureListener();
  if (!isNative) return;
  calendarStore.set((prev) => ({ ...prev, syncing: true, error: null }));
  triggerCompanionMood("curious", 4000);
  try {
    await invoke("calendar_sync");
    await syncAllSubscriptions();
  } catch (err) {
    calendarStore.set((prev) => ({
      ...prev,
      syncing: false,
      error: typeof err === "string" ? err : "Sync failed",
    }));
  }
}

export async function openCalendarAuthWindow(): Promise<void> {
  ensureListener();
  if (!isNative) return;
  try {
    const status = await invoke<CalendarStatusPayload>("calendar_open_auth");
    calendarStore.set((prev) => ({
      ...prev,
      ...status,
      account: status.account ?? prev.account,
    }));
  } catch {
    // Ignore
  }
}

export async function openExternalUrl(url: string): Promise<void> {
  if (!url) return;
  if (!isNative) {
    window.open(url, "_blank", "noopener,noreferrer");
    return;
  }
  try {
    await invoke("calendar_open_url", { url });
  } catch {
    window.open(url, "_blank", "noopener,noreferrer");
  }
}

export function selectCalendarDate(dateKey: string) {
  const d = fromDateKey(dateKey);
  calendarStore.set((prev) => ({
    ...prev,
    selectedDateKey: dateKey,
    viewMonth: { year: d.getFullYear(), month: d.getMonth() },
  }));
}

export function shiftCalendarMonth(delta: number) {
  calendarStore.set((prev) => {
    const next = new Date(prev.viewMonth.year, prev.viewMonth.month + delta, 1);
    return {
      ...prev,
      viewMonth: { year: next.getFullYear(), month: next.getMonth() },
    };
  });
}

export function jumpToToday() {
  const now = new Date();
  const todayKey = toDateKey(now);
  calendarStore.set((prev) => ({
    ...prev,
    selectedDateKey: todayKey,
    viewMonth: { year: now.getFullYear(), month: now.getMonth() },
  }));
  triggerCompanionMood("happy", 4000);
}

/**
 * Filters events, excluding any from disabled calendars, and applies custom aliases & colors.
 */
export function filterVisibleEvents(
  events: CalendarEventItem[],
  disabledCalendars: string[] = [],
  aliases: Record<string, string> = {},
  colors: Record<string, string> = {}
): CalendarEventItem[] {
  const disabledSet = new Set(disabledCalendars);
  const filtered = disabledCalendars.length > 0
    ? events.filter((ev) => !disabledSet.has(ev.calendarName))
    : events;

  const hasAliases = Object.keys(aliases).length > 0;
  const hasColors = Object.keys(colors).length > 0;
  if (!hasAliases && !hasColors) return filtered;

  return filtered.map((ev) => {
    const alias = aliases[ev.calendarName];
    const color = colors[ev.calendarName];
    if (!alias && !color) return ev;
    return {
      ...ev,
      calendarName: alias || ev.calendarName,
      color: color || ev.color,
    };
  });
}

/**
 * Returns a clean summary list of all distinct calendars detected in `events`
 * plus any configured URL subscriptions, reflecting custom aliases and colors.
 */
export function getCalendarList(
  events: CalendarEventItem[],
  disabledCalendars: string[] = [],
  subscriptions: CalendarSubscription[] = [],
  aliases: Record<string, string> = {},
  colors: Record<string, string> = {}
): CalendarListItem[] {
  const disabledSet = new Set(disabledCalendars);
  const counts = new Map<string, { color: string; count: number }>();

  for (const ev of events) {
    const name = ev.calendarName || "Calendar";
    const existing = counts.get(name);
    if (existing) {
      existing.count += 1;
    } else {
      counts.set(name, { color: ev.color || "#4285f4", count: 1 });
    }
  }

  // Ensure all configured subscriptions appear even if they currently have 0 events
  for (const sub of subscriptions) {
    if (!counts.has(sub.name)) {
      counts.set(sub.name, { color: sub.color || "#8b5cf6", count: 0 });
    }
  }

  const subMap = new Map<string, CalendarSubscription>();
  for (const sub of subscriptions) {
    subMap.set(sub.name, sub);
  }

  const list: CalendarListItem[] = [];
  for (const [name, meta] of counts.entries()) {
    const sub = subMap.get(name);
    list.push({
      name,
      displayName: aliases[name] || name,
      color: colors[name] || meta.color,
      count: meta.count,
      enabled: !disabledSet.has(name),
      isSubscription: Boolean(sub),
      subscriptionId: sub?.id,
    });
  }

  return list.sort((a, b) => {
    // Put subscriptions at the end, then sort by event count descending
    if (Boolean(a.isSubscription) !== Boolean(b.isSubscription)) {
      return a.isSubscription ? 1 : -1;
    }
    return b.count - a.count;
  });
}

/**
 * Renames a calendar (sets a user-friendly alias).
 */
export function renameCalendar(originalName: string, newName: string) {
  const clean = newName.trim();
  updateSettings((s) => {
    const curAliases = { ...(s.calendar?.calendarAliases ?? {}) };
    if (!clean || clean === originalName) {
      delete curAliases[originalName];
    } else {
      curAliases[originalName] = clean;
    }
    return {
      ...s,
      calendar: {
        ...(s.calendar ?? { showInPill: true }),
        calendarAliases: curAliases,
      },
    };
  });
}

/**
 * Sets a custom badge & event color for a calendar.
 */
export function setCalendarColor(originalName: string, color: string) {
  updateSettings((s) => {
    const curColors = { ...(s.calendar?.calendarColors ?? {}) };
    if (!color) {
      delete curColors[originalName];
    } else {
      curColors[originalName] = color;
    }
    return {
      ...s,
      calendar: {
        ...(s.calendar ?? { showInPill: true }),
        calendarColors: curColors,
      },
    };
  });
}

/**
 * Toggles a calendar's visibility on or off in settings.
 */
export function toggleCalendar(name: string, enabled: boolean) {
  updateSettings((s) => {
    const curDisabled = new Set(s.calendar?.disabledCalendars ?? []);
    if (enabled) {
      curDisabled.delete(name);
    } else {
      curDisabled.add(name);
    }
    return {
      ...s,
      calendar: {
        ...(s.calendar ?? { showInPill: true }),
        disabledCalendars: Array.from(curDisabled),
      },
    };
  });
}

/**
 * Selects all or deselects all calendars.
 */
export function toggleAllCalendars(allNames: string[], enableAll: boolean) {
  updateSettings((s) => ({
    ...s,
    calendar: {
      ...(s.calendar ?? { showInPill: true }),
      disabledCalendars: enableAll ? [] : [...allNames],
    },
  }));
}

/**
 * Adds an external WebCal / iCal subscription (e.g. university / school schedule),
 * fetches all its events immediately in Rust, and persists the subscription.
 */
export async function addCalendarSubscription(
  name: string,
  url: string,
  color = "#8b5cf6"
): Promise<{ success: boolean; error?: string; eventCount?: number }> {
  if (!url || !url.trim()) return { success: false, error: "Please enter a valid schedule URL" };
  const cleanName = name.trim() || "School Schedule";
  const subId = "sub-" + Date.now();

  try {
    const fetchedEvents = await invoke<CalendarEventItem[]>("calendar_fetch_url", {
      url: url.trim(),
      defaultName: cleanName,
      defaultColor: color,
    });

    // Tag events with the subscription ID prefix to allow clean removal
    const taggedEvents = (fetchedEvents || []).map((e) => ({
      ...e,
      id: `sub-${subId}-${e.id}`,
      calendarName: cleanName,
      color: color,
    }));

    // Save to settings
    updateSettings((s) => {
      const curSubs = s.calendar?.subscriptions ?? [];
      const newSub: CalendarSubscription = {
        id: subId,
        name: cleanName,
        url: url.trim(),
        color,
        enabled: true,
      };
      return {
        ...s,
        calendar: {
          ...(s.calendar ?? { showInPill: true }),
          subscriptions: [...curSubs.filter((x) => x.url !== url.trim()), newSub],
        },
      };
    });

    // Merge into store
    calendarStore.set((prev) => ({
      ...prev,
      events: mergeEvents(prev.events, taggedEvents),
    }));

    triggerCompanionMood("happy", 3000);
    return { success: true, eventCount: taggedEvents.length };
  } catch (err) {
    return {
      success: false,
      error: typeof err === "string" ? err : "Failed to load schedule from URL",
    };
  }
}

/**
 * Removes an external calendar subscription and clears its events.
 */
export function removeCalendarSubscription(subId: string) {
  const currentSub = (settings.get().calendar?.subscriptions ?? []).find((s) => s.id === subId);
  const subName = currentSub?.name;

  updateSettings((s) => ({
    ...s,
    calendar: {
      ...(s.calendar ?? { showInPill: true }),
      subscriptions: (s.calendar?.subscriptions ?? []).filter((x) => x.id !== subId),
      disabledCalendars: (s.calendar?.disabledCalendars ?? []).filter((n) => n !== subName),
    },
  }));

  calendarStore.set((prev) => ({
    ...prev,
    events: prev.events.filter((e) => !e.id.startsWith(`sub-${subId}-`) && e.calendarName !== subName),
  }));
}

/**
 * Background worker to refresh all active URL subscriptions.
 */
export async function syncAllSubscriptions(): Promise<void> {
  const subs = (settings.get().calendar?.subscriptions ?? []).filter((s) => s.enabled);
  if (subs.length === 0 || !isNative) return;

  const allSubEvents: CalendarEventItem[] = [];
  for (const sub of subs) {
    try {
      const fetched = await invoke<CalendarEventItem[]>("calendar_fetch_url", {
        url: sub.url,
        defaultName: sub.name,
        defaultColor: sub.color,
      });
      if (fetched && fetched.length > 0) {
        for (const e of fetched) {
          allSubEvents.push({
            ...e,
            id: `sub-${sub.id}-${e.id}`,
            calendarName: sub.name,
            color: sub.color,
          });
        }
      }
    } catch {
      // Continue next subscription
    }
  }

  if (allSubEvents.length > 0) {
    calendarStore.set((prev) => {
      // Remove previous subscription events and replace with fresh ones
      const nonSubEvents = prev.events.filter((e) => !e.id.startsWith("sub-"));
      return {
        ...prev,
        events: mergeEvents(nonSubEvents, allSubEvents),
      };
    });
  }
}

/**
 * Returns all events that occur on `dateKey` (`YYYY-MM-DD`).
 */
export function getEventsForDateKey(
  events: CalendarEventItem[],
  dateKey: string
): CalendarEventItem[] {
  const dayStart = fromDateKey(dateKey);
  dayStart.setHours(0, 0, 0, 0);
  const startOfDayMs = dayStart.getTime();
  const endOfDayMs = startOfDayMs + 86_400_000 - 1;

  return events
    .filter((ev) => ev.endMs >= startOfDayMs && ev.startMs <= endOfDayMs)
    .sort((a, b) => {
      if (a.allDay !== b.allDay) return a.allDay ? -1 : 1;
      return a.startMs - b.startMs;
    });
}

/**
 * Builds a fast lookup map of `YYYY-MM-DD -> color[]` (up to 3 dot colors per day)
 * for rendering indicator dots in the Month Grid.
 */
export function buildMonthEventDots(
  events: CalendarEventItem[],
  year: number,
  month: number
): Map<string, string[]> {
  const map = new Map<string, string[]>();
  const firstDay = new Date(year, month, 1, 0, 0, 0, 0).getTime() - 7 * 86_400_000;
  const lastDay = new Date(year, month + 1, 0, 23, 59, 59, 999).getTime() + 7 * 86_400_000;

  for (const ev of events) {
    if (ev.endMs < firstDay || ev.startMs > lastDay) continue;
    const cur = new Date(Math.max(ev.startMs, firstDay));
    cur.setHours(0, 0, 0, 0);
    const endLimit = Math.min(ev.endMs, lastDay);

    let safety = 0;
    while (cur.getTime() <= endLimit && safety < 45) {
      const key = toDateKey(cur);
      const list = map.get(key) ?? [];
      if (list.length < 3 && !list.includes(ev.color)) {
        list.push(ev.color);
        map.set(key, list);
      }
      cur.setDate(cur.getDate() + 1);
      safety++;
    }
  }
  return map;
}

export interface NextPillEventInfo {
  event: CalendarEventItem;
  isLive: boolean;
  minutesUntil: number;
  minutesLeft: number;
}

/**
 * Finds the most relevant active or upcoming event within the next 18 hours
 * for the Mini-Island Peek Pill and Companion Timekeeper badge.
 */
export function getNextPillEvent(
  events: CalendarEventItem[],
  nowMs: number = Date.now()
): NextPillEventInfo | null {
  const horizonMs = nowMs + 18 * 3_600_000;

  // 1. Prefer timed events currently live or starting within 18h
  const timedCandidates = events.filter(
    (ev) => !ev.allDay && ev.endMs > nowMs && ev.startMs <= horizonMs
  );

  if (timedCandidates.length > 0) {
    timedCandidates.sort((a, b) => a.startMs - b.startMs);
    const next = timedCandidates[0];
    const isLive = next.startMs <= nowMs && next.endMs > nowMs;
    const minutesUntil = Math.max(0, Math.round((next.startMs - nowMs) / 60_000));
    const minutesLeft = Math.max(1, Math.round((next.endMs - nowMs) / 60_000));
    return { event: next, isLive, minutesUntil, minutesLeft };
  }

  // 2. Otherwise check if there is an all-day event today
  const todayKey = toDateKey(nowMs);
  const todayAllDay = getEventsForDateKey(events, todayKey).find((e) => e.allDay);
  if (todayAllDay) {
    return {
      event: todayAllDay,
      isLive: true,
      minutesUntil: 0,
      minutesLeft: 0,
    };
  }

  return null;
}
