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

**Google-Companion Notchbar** turns the top of your Windows screen into an interactive, fluid Dynamic Island inhabited by a living digital companion (**BMO**).

It sits discreetly along your top screen bezel, reacts fluidly to hover and clicks, and seamlessly transitions through 3 stages:
1. **Stage 1 — Closed:** A minimalist, sleek pill or completely hidden hover trigger strip that stays out of your way.
2. **Stage 2 — Peek Island:** Expands into a compact interactive island housing your living companion, glanceable weather info, or live media playback controls.
3. **Stage 3 — Expanded Notch:** Smoothly expands into full windows for system overview, music player, settings, and modular dock tools.

---

## Features

### 👾 The Living Companion (BMO)
* **Always Alive:** Lives continuously across Peek Island and Open Dropdown views with zero pop-in or lag.
* **Interactive Gestures:**
  * **Head Pats:** Gently hover above his head to pet him (shows blissful, blushing expressions).
  * **Belly Tickles:** Wiggle your cursor back and forth across his body to tickle him with playful laughter.
  * **Curious Watcher:** Tracks your mouse movements and curious glances.
  * **Study State:** Quiet, focused study animations with his favorite book.
* **Music Reactive Vibing:** Automatically equips glowing headphones when music plays and bobs to the beat across dynamic energy levels.
* **Full Customization:** Choose from multiple shapes (Circle, Squircle, Egg, Scallop, Tower, Slime, Hexagon, Triangle), Google and custom color palettes, hats (Beanies, Crowns, Halos), and eyewear (Glasses, Shades).

### 🎵 Media & System Control
* **Now Playing:** Windows media session integration (Spotify, Chrome, browser players) with live album art, track scrubbers, and responsive playback controls.
* **Overview Center:** Live clock, local weather forecast with auto IP detection, power controls (Lock & Sleep), Bluetooth battery indicators, and smooth volume & brightness sliders.

### 🎨 Modular Dock & Tab Categorization
* **Categorized Bottom Dock:** Group your tools into custom categories. Tabs in different categories are automatically separated by elegant vertical `|` dividers in the dock.
* **Tab Management:** Reorder tabs (Overview, Music, and future modular plugins) and configure their categories directly in Settings with a real-time dock preview.
* **Background Visualizers:** Customize your notch backdrop with ambient audio visualizers, aurora borealis, night skies, synthwave neon grids, topographic contours, or frosted glass.

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
