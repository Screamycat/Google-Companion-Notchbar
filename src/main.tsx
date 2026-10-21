import { StrictMode } from "react";
import { invoke } from "@tauri-apps/api/core";
import { createRoot } from "react-dom/client";
import { MotionConfig } from "motion/react";
import "./styles/global.css";
import { Notch } from "./notch/Notch";
import { DesktopMock } from "./dev/DesktopMock";
import { isNative, setAiShortcut, setNotchShortcut } from "./platform/native";
import { startDropListener } from "./platform/drop";
import { clipboard } from "./platform/clipboard";
import { settings } from "./settings/store";
import { applyDisplay } from "./notch/drag";
import { startSystemPolling } from "./features/system/store";
import { startGamingWatch } from "./features/system/gaming";
import { startDiscord } from "./features/discord/store";
import { startUpdateWatch } from "./lib/update";
import { showcase } from "./dev/showcase-data";
import { startShowcase } from "./dev/showcase";

if (showcase) startShowcase();

startDropListener();
startSystemPolling();
startGamingWatch();
startDiscord();
startUpdateWatch();

// Send display settings (monitor, fullscreen, offset, gaming) to Rust on start and on every change.
let lastDisplay = "";
const syncDisplay = () => {
  const { display, gaming } = settings.get();
  const key = `${display.visibility}|${display.monitor}|${display.offset}|${gaming.mode}`;
  if (key === lastDisplay) return;
  lastDisplay = key;
  applyDisplay();
};
syncDisplay();
settings.subscribe(syncDisplay);

// Clipboard history only records when the clipboard tool is enabled.
let lastClipMode = "";
const syncClipboardMode = () => {
  const on = (id: string) => settings.get().tools.some((t) => t.id === id && t.enabled);
  const mode = on("clipboard") ? "all" : "off";
  if (mode === lastClipMode) return;
  lastClipMode = mode;
  clipboard.mode(mode);
};
syncClipboardMode();
settings.subscribe(syncClipboardMode);

// Clipboard limits & history sync to Rust
let lastLimits = "";
const syncClipboardLimits = () => {
  const { clipboardMaxItems = 30, clipboardMaxImages = 6 } = settings.get();
  const key = `${clipboardMaxItems}-${clipboardMaxImages}`;
  if (key === lastLimits) return;
  lastLimits = key;
  if (isNative) void invoke("clipboard_set_limits", { maxItems: clipboardMaxItems, maxImages: clipboardMaxImages });
};
syncClipboardLimits();
settings.subscribe(syncClipboardLimits);

// Sync Open / Close Notch global shortcut to Rust
let lastNotchSc = "";
const syncNotchShortcut = () => {
  const sc = settings.get().notchShortcut || "Ctrl+Alt+Space";
  if (sc === lastNotchSc) return;
  lastNotchSc = sc;
  void setNotchShortcut(sc === "off" ? null : sc);
};
syncNotchShortcut();
settings.subscribe(syncNotchShortcut);

// Sync AI Assistant global shortcut to Rust on start and on every change.
let lastAiSc = "";
const syncAiShortcut = () => {
  const sc = settings.get().aiShortcut || "Alt+A";
  if (sc === lastAiSc) return;
  lastAiSc = sc;
  void setAiShortcut(sc === "off" ? null : sc);
};
syncAiShortcut();
settings.subscribe(syncAiShortcut);

// Language: update the tray menu in Rust and set the lang attribute.
let lastLang = "";
const applyLanguage = () => {
  const { language } = settings.get();
  if (language === lastLang) return;
  lastLang = language;
  document.documentElement.lang = language;
  if (isNative) void invoke("set_language", { lang: language });
};
applyLanguage();
settings.subscribe(applyLanguage);

// The notch isn't a web page: no browser context menu (except in text fields for
// cut/paste) and in the app no browser shortcuts like reload or print.
window.addEventListener("contextmenu", (e) => {
  if (!(e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement)) e.preventDefault();
});
if (isNative) {
  window.addEventListener("keydown", (e) => {
    const k = e.key.toLowerCase();
    if (e.key === "F5" || e.key === "F7" || e.key === "F12" || (e.ctrlKey && ["r", "p", "f", "g", "j", "u", "s"].includes(k))) e.preventDefault();
  });
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    {/* reducedMotion="user": Motion respects the Windows "Animation effects" setting. */}
    <MotionConfig reducedMotion="user">
      {!isNative && <DesktopMock />}
      <Notch />
    </MotionConfig>
  </StrictMode>,
);
