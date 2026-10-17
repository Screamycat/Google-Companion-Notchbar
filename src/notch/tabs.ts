import type { ComponentType } from "react";
import {
  GearSix,
  MusicNotesSimple,
  SquaresFour,
  type Icon,
} from "@phosphor-icons/react";
import { OverviewView } from "../features/overview/OverviewView";
import { NowPlayingView } from "../features/now-playing/NowPlayingView";
import { SettingsView } from "../features/settings/SettingsView";

/**
 * Registry of active tabs in the open notch.
 * Tabs sharing the same `category` are grouped together in the bottom dock;
 * a vertical `|` divider is automatically rendered between different categories.
 */
export interface NotchTab {
  id: string;
  label: string;
  icon: Icon;
  category: "main" | "system";
  size: { w: number; h: number };
  View: ComponentType;
}

export const tabs: NotchTab[] = [
  {
    id: "overview",
    label: "Übersicht",
    icon: SquaresFour,
    category: "main",
    size: { w: 540, h: 300 },
    View: OverviewView,
  },
  {
    id: "media",
    label: "Wiedergabe",
    icon: MusicNotesSimple,
    category: "main",
    size: { w: 540, h: 260 },
    View: NowPlayingView,
  },
];

/** Settings tab: separated by a `|` divider to the right in its own category. */
export const settingsTab: NotchTab = {
  id: "settings",
  label: "Einstellungen",
  icon: GearSix,
  category: "system",
  size: { w: 620, h: 420 },
  View: SettingsView,
};

/** All dock tabs in order (including Settings on the right). */
export const allDockTabs: NotchTab[] = [...tabs, settingsTab];

export function findTab(id: string): NotchTab | undefined {
  return id === settingsTab.id ? settingsTab : tabs.find((t) => t.id === id);
}
