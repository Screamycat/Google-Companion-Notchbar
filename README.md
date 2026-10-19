<h1 align="center">Google-Companion Notchbar</h1>

<p align="center">
  <b>A living desktop companion embedded in a fluid Dynamic Island for Windows.</b>
</p>

<p align="center">
  <a href="https://github.com/Screamycat/Google-Companion-Notchbar/releases/latest"><img src="https://img.shields.io/github/v/release/Screamycat/Google-Companion-Notchbar?style=flat-square&label=release&color=111" alt="Latest release" /></a>
  <img src="https://img.shields.io/badge/Windows-10%20%7C%2011-111?style=flat-square" alt="Windows 10 and 11" />
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-GPL--3.0-111?style=flat-square" alt="GPL-3.0" /></a>
</p>

<p align="center">
  <a href="https://github.com/Screamycat/Google-Companion-Notchbar/releases/latest"><b>Download</b></a>
  &nbsp;·&nbsp;
  <a href="#features"><b>Features</b></a>
  &nbsp;·&nbsp;
  <a href="#settings--customization"><b>Customization</b></a>
  &nbsp;·&nbsp;
  <a href="https://github.com/Screamycat/Google-Companion-Notchbar/issues/new"><b>Suggest an idea</b></a>
</p>

---

## What is Google-Companion Notchbar?

**Google-Companion Notchbar** brings a modern, fluid Dynamic Island top bar to Windows, inhabited by a living, fully customizable desktop companion.

Forked and evolved from [Linux5Real's L4-Windows-NotchBar](https://github.com/Linux5Real/L4-Windows-NotchBar), this repository transforms the original notch concept into a personal desktop space:
* **Your Own Living Companion:** An autonomous, interactive buddy that lives directly at the top of your screen. Give it any name you want, choose its body shape, pick color palettes, equip hats and eyewear, pet or tickle it with your mouse, and watch it react and groove to your music.
* **Smart Dynamic Notch:** Rests discreetly along the top bezel of your display. Hover or click to reveal glanceable weather, media playback controls, and modular tool tabs without interrupting your workflow.
* **Music-Reactive Audio Engine:** Built-in DSP listening directly to Windows audio output via WASAPI loopback, with percussive transient detection and user-tunable vibe thresholds.
* **Independent & Decoupled:** Dedicated release and in-app update pipeline, streamlined settings, modular tab groups, and continuous performance optimizations for Windows 10 & 11.

---

## Features

### 👾 The Living Companion
* **Always Present:** Lives seamlessly inside the notch bar and expands into the full view with zero pop-in or stutter.
* **Name & Appearance:** Give your companion your favorite name, and customize it with 9 distinct shapes (Circle, Squircle, Egg, Capsule, Scallop, Tower, Slime, Hexagon, Triangle), color themes, aura glows, cozy hats (Beanies, Crowns, Halos), and eyewear (Glasses, Shades).
* **Tactile Interactions:**
  * **Head Pats:** Gently stroke above its head to pet it (features purring smile and blush cheeks).
  * **Belly Tickles:** Wiggle your cursor back and forth across its body to tickle it with giggling laughter.
  * **Eye Tracking:** Follows cursor movements with curious glances across your desktop.
  * **Idle Life:** Autonomous expressions, yawns, sneezes, and cozy study sessions with an open book.
* **Dynamic Music Grooving:** Automatically puts on glowing headphones during audio playback and dances across 3 distinct energy tiers:
  * **Level 1 (Chill Sway):** Relaxed, serene swaying for ambient, lo-fi, acoustic, and quiet passages.
  * **Level 2 (Hard Groove):** Rhythmic head-bobbing and energized beats for upbeat tracks.
  * **Level 3 (Super Hype):** Intense rock-out mode for bass drops, hardstyle, fast BPM, and climaxes.

### 🎚️ Live Audio Analyzer & Vibe Thresholds
* **Transient Impulse DSP:** Real-time crest factor and spectral flux analysis captures true percussive drum kicks and beat drops while keeping peaceful ambient music calm.
* **Tunable Threshold Sliders:** Configure exact crossover points on a 0–100 energy scale directly in Settings, complete with a live needle indicator, active zone highlights, and real-time vibe state badges.

### 🎵 Media & System Control
* **Media Playback:** Real-time Windows media session integration (Spotify, Chrome, YouTube, Apple Music) with album art, track scrubbers, and playback controls.
* **Overview Center:** Live clock, weather forecast with auto IP detection, power controls (Lock & Sleep), Bluetooth battery indicators, and smooth volume & brightness sliders.

### 🎨 Modular Dock & Tab Groups
* **Grouped Bottom Dock:** Organize tools into custom groups separated by clean vertical `|` dividers in the dock.
* **Drag-and-Drop Management:** Reorder dock tabs (Overview, Music, and upcoming modular extensions) and toggle visibility with an instant live dock preview in Settings.
* **Dynamic Notch Backgrounds:** Customize your notch backdrop with ambient audio visualizers, aurora borealis, night skies, synthwave neon grids, topographic contours, or frosted glass.

---

## Installation

1. Download `Google-Companion Notchbar_x.y.z_x64-setup.exe` from the [Latest Release](https://github.com/Screamycat/Google-Companion-Notchbar/releases/latest).
2. Run the installer. No developer tools or administrative privileges required — installs cleanly into your user profile.
3. The notch will appear at the top of your display and launch automatically on Windows login (configurable in settings).

> [!NOTE]
> Because Windows SmartScreen flags newly released unsigned open-source binaries, click **More info → Run anyway** if prompted on first install.

---

## Settings & Customization

The settings window is neatly structured into 5 dedicated pages:

| Page | Description |
| :--- | :--- |
| **Companion** | Rename your buddy, choose body shape, color palette, hats, eyewear, and toggle smart accessories & aura. |
| **Appearance** | Select dynamic background effects (visualizer, waves, aurora, synthwave), accent colors, and glass materials. |
| **Size & Timing** | Tune compact peek width/height, open window dimensions, bottom & ear curvature, hover sensitivity, and trigger zones. |
| **Tabs** | Reorder dock tools, assign them to categories (separated by `|` dividers), and toggle visibility with live dock preview. |
| **General** | Multi-monitor selection, Windows autostart toggle, weather location provider, and in-app updates with changelog. |

---

## In-App Updates

* **Automated & Signed:** Updates are securely signed using minisign and fetched directly from GitHub releases (`Screamycat/Google-Companion-Notchbar`).
* **Silent & Safe:** The app checks for new updates daily in the background (or on demand under **Settings → General → Updates**) without transmitting any personal data.

---

## Development

Built with modern high-performance desktop technologies:
* **Tauri 2 & Rust:** Low-latency Windows WASAPI loopback audio capture, system tray, hardware monitors, and lightweight memory footprint (~80 MB idle).
* **React 19 & TypeScript:** State-driven reactive architecture.
* **Motion:** 60 FPS physics-based spring animations.
* **Tailwind CSS 4:** Modern utility-first styling.

### Setup

```bash
# Clone the repository
git clone https://github.com/Screamycat/Google-Companion-Notchbar.git
cd Google-Companion-Notchbar

# Install dependencies
npm install

# Run frontend in development mode
npm run dev

# Run full desktop app with Tauri (in PowerShell)
npm run tauri dev

# Typecheck and build production bundle
npm run typecheck
npm run build
```

---

## License

[GPL-3.0](LICENSE). Free and open source for personal and commercial study, modification, and distribution under GPL-3.0.
