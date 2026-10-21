import { useEffect, useRef } from "react";
import { audioLevelsAvailable, subscribeLevels, type Levels } from "../platform/audio";
import { settings, DEFAULT_DYNAMIC_WORLD, type DynamicWorldConfig } from "../settings/store";
import { useForecast } from "../features/weather/store";

type RGB = [number, number, number];

function parseRgb(css: string): RGB {
  const m = css.match(/rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)/);
  if (!m) return [66, 133, 244];
  return [Math.min(255, +m[1]), Math.min(255, +m[2]), Math.min(255, +m[3])];
}

function css(c: RGB, a = 1): string {
  return `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`;
}

function mix(a: RGB, b: RGB, k: number): RGB {
  return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];
}

type TimeOfDay = "dawn" | "day" | "sunset" | "dusk" | "night";

interface SkyPalette {
  top: RGB;
  mid: RGB;
  bottom: RGB;
}

const SKY_PALETTES: Record<TimeOfDay, SkyPalette> = {
  dawn: {
    top: [42, 19, 61],      // Deep purple
    mid: [115, 52, 78],     // Dusty rose
    bottom: [245, 158, 11], // Golden sunrise amber
  },
  day: {
    top: [14, 65, 148],     // Cobalt blue
    mid: [56, 189, 248],    // Sky cyan
    bottom: [147, 197, 253],// Soft horizon azure
  },
  sunset: {
    top: [28, 8, 46],       // Deep amethyst
    mid: [157, 23, 77],     // Magenta crimson
    bottom: [249, 115, 22], // Radiant sunset orange
  },
  dusk: {
    top: [12, 10, 33],      // Obsidian violet
    mid: [30, 27, 75],      // Midnight indigo
    bottom: [67, 56, 202],  // Twilight blue
  },
  night: {
    top: [5, 7, 19],        // Cosmic void
    mid: [11, 16, 38],      // Deep navy starlight
    bottom: [2, 3, 8],      // Pitch horizon
  },
};

export function DynamicWorldScene({
  playing,
  radius,
  status,
  activeTab,
}: {
  playing: boolean;
  radius: number;
  status?: string;
  activeTab?: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const cfg: DynamicWorldConfig = settings.use().appearance.dynamicWorld ?? DEFAULT_DYNAMIC_WORLD;
  const forecast = useForecast();
  const statusRef = useRef(status);
  statusRef.current = status;
  const activeTabRef = useRef(activeTab);
  activeTabRef.current = activeTab;

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    const TS = matchMedia("(prefers-reduced-motion: reduce)").matches ? 0.35 : 1;
    const readBase = (): RGB => parseRgb(getComputedStyle(canvas).getPropertyValue("--accent") || "#4285f4");

    const updateSize = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = Math.max(10, Math.round(rect.width));
      const h = Math.max(10, Math.round(rect.height));
      const targetW = Math.round(w * dpr);
      const targetH = Math.round(h * dpr);
      if (canvas.width !== targetW || canvas.height !== targetH) {
        canvas.width = targetW;
        canvas.height = targetH;
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      return { w, h };
    };

    // Particle pools
    // 1. Rain streaks (increased pool for lush, atmospheric rain and drizzle)
    const rainDrops = Array.from({ length: 120 }, () => ({
      x: Math.random(),
      y: Math.random(),
      speed: 0.45 + Math.random() * 0.55,
      len: 12 + Math.random() * 20,
      alpha: 0.35 + Math.random() * 0.5,
    }));

    // 2. Window condensation beads
    const condensationBeads = Array.from({ length: 40 }, () => ({
      x: Math.random(),
      y: Math.random(),
      r: 1.1 + Math.random() * 1.6,
      alpha: 0.18 + Math.random() * 0.32,
    }));

    // 3. Snowflakes
    const snowflakes = Array.from({ length: 75 }, () => ({
      x: Math.random(),
      y: Math.random(),
      speed: 0.15 + Math.random() * 0.35,
      r: 1.2 + Math.random() * 1.8,
      alpha: 0.35 + Math.random() * 0.55,
      seed: Math.random() * 100,
    }));

    // 4. Wind-blown leaves
    const leaves = Array.from({ length: 22 }, () => ({
      x: Math.random(),
      y: Math.random(),
      vx: 0.35 + Math.random() * 0.45,
      vy: 0.08 + Math.random() * 0.18,
      size: 3.5 + Math.random() * 3.5,
      rot: Math.random() * Math.PI * 2,
      vrot: (Math.random() - 0.5) * 0.08,
      color: Math.random() > 0.5 ? "rgba(234, 88, 12, 0.75)" : "rgba(245, 158, 11, 0.75)",
    }));

    // 5. Stars
    const stars = Array.from({ length: 65 }, () => ({
      rx: Math.random(),
      ry: Math.random() * 0.85,
      r: 0.6 + Math.random() * 1.4,
      p: Math.random() * Math.PI * 2,
      s: 0.6 + Math.random() * 2.2,
    }));

    // 6. Meteors
    const meteors: { x: number; y: number; vx: number; vy: number; life: number }[] = [];
    let nextMeteor = 3;

    // Audio & Frame state
    let frame = 0;
    let last = performance.now();
    let n = 0;
    let live: { values: Levels; at: number } | null = null;
    const off = playing && audioLevelsAvailable ? subscribeLevels((values) => (live = { values, at: performance.now() })) : null;

    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      n += dt;
      const t = n * TS;

      // Audio volume
      const lv = live && now - live.at < 300 ? live.values : null;
      const loud = lv ? (lv[0] + lv[1] + lv[2] + lv[3]) * 0.25 : 0;
      const ink = readBase();

      const { w, h } = updateSize();
      ctx.clearRect(0, 0, w, h);

      // --- 1. RESOLVE TIME OF DAY ---
      let resolvedTime: TimeOfDay = "night";
      if (cfg.timeMode === "auto") {
        const d = new Date();
        const hr = d.getHours() + d.getMinutes() / 60;
        const isDay = forecast && forecast !== "error" ? forecast.current.day : (hr >= 6.5 && hr < 18.5);

        if (isDay) {
          if (hr < 8) resolvedTime = "dawn";
          else if (hr >= 17) resolvedTime = "sunset";
          else resolvedTime = "day";
        } else {
          if (hr >= 16.5 && hr < 20) resolvedTime = "dusk";
          else resolvedTime = "night";
        }
      } else {
        resolvedTime = cfg.timeMode;
      }

      // --- 2. RESOLVE WEATHER ---
      let rainLevel: "off" | "light" | "medium" | "heavy" = cfg.rain;
      let snowLevel: "off" | "light" | "heavy" = cfg.snow;
      let cloudsLevel: "clear" | "scattered" | "overcast" | "fog" = cfg.clouds;
      let thunder = cfg.thunder;
      let windLeaves = cfg.windLeaves;

      if (cfg.weatherMode === "auto" && forecast && forecast !== "error") {
        const code = forecast.current.code;
        // Rain & Drizzle detection (WMO 51-57 drizzle, 61-67 rain, 80-82 showers, 95+ thunderstorm)
        if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82) || code >= 95) {
          if (code === 51 || code === 56) {
            rainLevel = "light"; // Fine, gentle drizzle
          } else if (code === 53 || code === 55 || code === 57 || code === 61 || code === 80) {
            rainLevel = "medium"; // Dense drizzle or moderate rain
          } else {
            rainLevel = "heavy"; // Heavy rain, downpour, thunderstorm
          }
        } else {
          rainLevel = "off";
        }

        // Snow detection (WMO 71-77, 85, 86)
        if ((code >= 71 && code <= 77) || code === 85 || code === 86) {
          snowLevel = code >= 75 || code === 86 ? "heavy" : "light";
        } else {
          snowLevel = "off";
        }

        // Cloud detection
        if (code >= 45 && code <= 48) {
          cloudsLevel = "fog";
        } else if (code === 3 || code >= 65 || code >= 95) {
          cloudsLevel = "overcast";
        } else if (code >= 1) {
          cloudsLevel = "scattered";
        } else {
          cloudsLevel = "clear";
        }

        thunder = code >= 95;
        windLeaves = forecast.current.wind > 18;
      }

      // --- 3. LAYER 1: SKY GRADIENT ---
      const palette = SKY_PALETTES[resolvedTime];
      let skyTop = palette.top;
      let skyMid = palette.mid;
      let skyBottom = palette.bottom;

      // Desaturate slightly if overcast or heavy rain
      if (cloudsLevel === "overcast" || rainLevel === "heavy") {
        skyTop = mix(skyTop, [25, 30, 42], 0.6);
        skyMid = mix(skyMid, [45, 55, 70], 0.6);
        skyBottom = mix(skyBottom, [60, 75, 95], 0.55);
      }

      const skyGrad = ctx.createLinearGradient(0, 0, 0, h);
      skyGrad.addColorStop(0, css(skyTop));
      skyGrad.addColorStop(0.55, css(skyMid));
      skyGrad.addColorStop(1, css(skyBottom));
      ctx.fillStyle = skyGrad;
      ctx.fillRect(0, 0, w, h);

      // --- 4. LAYER 2: CELESTIAL BODIES (SUN / MOON / STARS / AURORA) ---
      // Aurora Borealis
      if (cfg.aurora) {
        ctx.globalCompositeOperation = "lighter";
        const auroraAlpha = 0.25 + (cfg.audioReactive ? loud * 0.28 : 0);
        const auroraGrad = ctx.createLinearGradient(0, 0, w, h * 0.6);
        auroraGrad.addColorStop(0, "rgba(52, 211, 153, 0)");
        auroraGrad.addColorStop(0.35, css(mix([52, 211, 153], ink, 0.4), auroraAlpha));
        auroraGrad.addColorStop(0.7, "rgba(99, 102, 241, 0.2)");
        auroraGrad.addColorStop(1, "rgba(52, 211, 153, 0)");
        ctx.fillStyle = auroraGrad;
        ctx.fillRect(0, 0, w, h * 0.7);
        ctx.globalCompositeOperation = "source-over";
      }

      // Stars & Meteors (visible during night, dusk, and dawn)
      const showStars = (resolvedTime === "night" || resolvedTime === "dusk" || resolvedTime === "dawn");
      if (showStars && cfg.stars !== "off") {
        const cloudFactor = cloudsLevel === "overcast" ? 0.65 : cloudsLevel === "scattered" ? 0.85 : 1;
        const starLimit = cfg.stars === "subtle" ? Math.min(25, Math.floor(w / 20)) : Math.min(stars.length, Math.floor(w / 8));
        for (let i = 0; i < starLimit; i++) {
          const st = stars[i];
          const pulse = cfg.audioReactive ? loud * 0.4 : 0;
          const alpha = (0.3 + 0.6 * (0.5 + 0.5 * Math.sin(t * st.s + st.p)) + pulse) * cloudFactor;
          ctx.fillStyle = `rgba(255, 255, 255, ${Math.min(1, alpha).toFixed(2)})`;
          ctx.beginPath();
          ctx.arc(st.rx * w, st.ry * h * 0.75, st.r, 0, Math.PI * 2);
          ctx.fill();
        }

        // Shooting Stars / Meteors
        if (cfg.stars === "meteors") {
          if (t > nextMeteor) {
            nextMeteor = t + 3 + Math.random() * 4;
            meteors.push({
              x: w * (0.2 + Math.random() * 0.7),
              y: h * Math.random() * 0.35,
              vx: -(180 + Math.random() * 140),
              vy: 100 + Math.random() * 80,
              life: 1,
            });
          }
          for (let i = meteors.length - 1; i >= 0; i--) {
            const m = meteors[i];
            m.x += m.vx * dt;
            m.y += m.vy * dt;
            m.life -= dt * 1.6;
            if (m.life <= 0) {
              meteors.splice(i, 1);
              continue;
            }
            const tail = 28 * m.life;
            const grad = ctx.createLinearGradient(m.x, m.y, m.x - m.vx * 0.08, m.y - m.vy * 0.08);
            grad.addColorStop(0, `rgba(255, 255, 255, ${m.life})`);
            grad.addColorStop(1, "rgba(255, 255, 255, 0)");
            ctx.strokeStyle = grad;
            ctx.lineWidth = 1.4;
            ctx.beginPath();
            ctx.moveTo(m.x, m.y);
            ctx.lineTo(m.x - (m.vx / 180) * tail, m.y - (m.vy / 180) * tail);
            ctx.stroke();
          }
        }
      }

      // Celestial Sun / Moon (skip in Clipboard / Settings tabs when open to prevent colliding with top filter pills and cards)
      const hideCelestial = statusRef.current === "open" && (activeTabRef.current === "clipboard" || activeTabRef.current === "settings");
      const celestial = hideCelestial ? "off" : cfg.celestial;
      const isDaySun = celestial === "sun" || (celestial === "auto" && (resolvedTime === "day" || resolvedTime === "dawn" || resolvedTime === "sunset"));
      const isNightMoon = celestial === "moon" || (celestial === "auto" && (resolvedTime === "night" || resolvedTime === "dusk"));

      if (isDaySun) {
        // Sun with warm golden corona - softens beautifully through overcast skies instead of vanishing abruptly
        const cloudDim = cloudsLevel === "overcast" ? 0.45 : cloudsLevel === "fog" ? 0.6 : 1;
        const sr = Math.min(22, Math.max(12, h * 0.16));
        const sx = w * (resolvedTime === "dawn" ? 0.38 : resolvedTime === "sunset" ? 0.62 : 0.5);
        const sy = h * (resolvedTime === "dawn" || resolvedTime === "sunset" ? 0.22 : 0.15);

        const corona = ctx.createRadialGradient(sx, sy, 0, sx, sy, sr * 3.5);
        corona.addColorStop(0, resolvedTime === "sunset" ? `rgba(251, 146, 60, ${0.45 * cloudDim})` : `rgba(253, 224, 71, ${0.45 * cloudDim})`);
        corona.addColorStop(1, "rgba(253, 224, 71, 0)");
        ctx.fillStyle = corona;
        ctx.fillRect(sx - sr * 3.5, sy - sr * 3.5, sr * 7, sr * 7);

        ctx.fillStyle = resolvedTime === "sunset"
          ? (cloudsLevel === "overcast" ? "rgba(253, 186, 116, 0.65)" : "#fdba74")
          : (cloudsLevel === "overcast" ? "rgba(254, 240, 138, 0.65)" : "#fef08a");
        ctx.beginPath();
        ctx.arc(sx, sy, sr, 0, Math.PI * 2);
        ctx.fill();
      } else if (isNightMoon) {
        // Moon with craters & ethereal lunar halo - glows softly through overcast clouds
        const cloudDim = cloudsLevel === "overcast" ? 0.45 : cloudsLevel === "fog" ? 0.55 : 1;
        const mr = Math.min(20, Math.max(12, h * 0.14));
        const mx = w * (resolvedTime === "dusk" ? 0.56 : 0.5);
        const my = h * (resolvedTime === "dusk" ? 0.2 : 0.15);

        const halo = ctx.createRadialGradient(mx, my, 0, mx, my, mr * 3.2);
        halo.addColorStop(0, `rgba(244, 241, 222, ${0.32 * cloudDim})`);
        halo.addColorStop(1, "rgba(244, 241, 222, 0)");
        ctx.fillStyle = halo;
        ctx.fillRect(mx - mr * 3.5, my - mr * 3.5, mr * 7, mr * 7);

        ctx.fillStyle = cloudsLevel === "overcast" ? "rgba(244, 241, 222, 0.65)" : "#f4f1de";
        ctx.beginPath();
        ctx.arc(mx, my, mr, 0, Math.PI * 2);
        ctx.fill();

        // Moon craters
        ctx.fillStyle = `rgba(190, 186, 160, ${0.45 * cloudDim})`;
        ctx.beginPath();
        ctx.arc(mx - mr * 0.3, my - mr * 0.2, mr * 0.24, 0, Math.PI * 2);
        ctx.arc(mx + mr * 0.25, my + mr * 0.35, mr * 0.16, 0, Math.PI * 2);
        ctx.fill();
      }

      // --- 5. LAYER 3: HORIZON & SCENERY ---
      if (cfg.horizon === "mountains") {
        // Far mountain range
        ctx.fillStyle = resolvedTime === "night" ? "#0a0e1c" : resolvedTime === "sunset" ? "#4a1236" : "#2d4469";
        ctx.beginPath();
        ctx.moveTo(0, h);
        ctx.lineTo(0, h * 0.65);
        ctx.lineTo(w * 0.2, h * 0.48);
        ctx.lineTo(w * 0.42, h * 0.68);
        ctx.lineTo(w * 0.68, h * 0.44);
        ctx.lineTo(w * 0.88, h * 0.62);
        ctx.lineTo(w, h * 0.54);
        ctx.lineTo(w, h);
        ctx.closePath();
        ctx.fill();

        // Near mountain range
        ctx.fillStyle = resolvedTime === "night" ? "#04060c" : resolvedTime === "sunset" ? "#26081e" : "#17253b";
        ctx.beginPath();
        ctx.moveTo(0, h);
        ctx.lineTo(0, h * 0.78);
        ctx.lineTo(w * 0.32, h * 0.58);
        ctx.lineTo(w * 0.55, h * 0.82);
        ctx.lineTo(w * 0.8, h * 0.64);
        ctx.lineTo(w, h * 0.75);
        ctx.lineTo(w, h);
        ctx.closePath();
        ctx.fill();
      } else if (cfg.horizon === "treehouse") {
        // Ghibli tree canopy along the horizon
        ctx.fillStyle = resolvedTime === "night" ? "#070b14" : resolvedTime === "sunset" ? "#311226" : "#0e231b";
        ctx.beginPath();
        ctx.moveTo(0, h);
        for (let x = 0; x <= w; x += 24) {
          const y = h * 0.74 + Math.sin(x * 0.04) * 7 + Math.cos(x * 0.08) * 3;
          ctx.lineTo(x, y);
        }
        ctx.lineTo(w, h);
        ctx.closePath();
        ctx.fill();

        // Fore canopy tree line
        ctx.fillStyle = resolvedTime === "night" ? "#03050a" : resolvedTime === "sunset" ? "#1a0815" : "#061510";
        ctx.beginPath();
        ctx.moveTo(0, h);
        for (let x = 0; x <= w; x += 20) {
          const y = h * 0.82 + Math.sin(x * 0.05 + 1) * 6;
          ctx.lineTo(x, y);
        }
        ctx.lineTo(w, h);
        ctx.closePath();
        ctx.fill();

        // Left hanging vine & leaves
        const vineL1 = Math.min(h * 0.62, 44);
        ctx.strokeStyle = resolvedTime === "night" ? "rgba(34, 197, 94, 0.45)" : "rgba(34, 197, 94, 0.75)";
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        ctx.moveTo(14, 0);
        ctx.quadraticCurveTo(24, vineL1 * 0.5, 12, vineL1);
        ctx.stroke();

        ctx.fillStyle = resolvedTime === "night" ? "rgba(22, 163, 74, 0.55)" : "#16a34a";
        ctx.beginPath();
        ctx.ellipse(20, vineL1 * 0.35, 5.5, 3.2, -0.4, 0, Math.PI * 2);
        ctx.ellipse(13, vineL1 * 0.65, 6, 3.5, 0.35, 0, Math.PI * 2);
        ctx.ellipse(15, vineL1, 4.5, 2.5, -0.2, 0, Math.PI * 2);
        ctx.fill();

        // Right hanging vine & leaves
        const vineR1 = Math.min(h * 0.72, 50);
        ctx.beginPath();
        ctx.moveTo(w - 16, 0);
        ctx.quadraticCurveTo(w - 26, vineR1 * 0.5, w - 14, vineR1);
        ctx.stroke();

        ctx.fillStyle = resolvedTime === "night" ? "rgba(22, 163, 74, 0.55)" : "#22c55e";
        ctx.beginPath();
        ctx.ellipse(w - 21, vineR1 * 0.3, 5.5, 3, 0.4, 0, Math.PI * 2);
        ctx.ellipse(w - 15, vineR1 * 0.6, 6, 3.2, -0.35, 0, Math.PI * 2);
        ctx.ellipse(w - 17, vineR1, 4.5, 2.5, 0.2, 0, Math.PI * 2);
        ctx.fill();
      } else if (cfg.horizon === "city") {
        // Far skyline layer
        ctx.fillStyle = resolvedTime === "night" ? "#0f0b1c" : resolvedTime === "sunset" ? "#381335" : "#202d45";
        const farBuildings = [
          { x: 0, w: 0.12, h: 0.32 },
          { x: 0.1, w: 0.08, h: 0.42 },
          { x: 0.22, w: 0.14, h: 0.28 },
          { x: 0.38, w: 0.1, h: 0.48 },
          { x: 0.52, w: 0.12, h: 0.35 },
          { x: 0.66, w: 0.09, h: 0.45 },
          { x: 0.78, w: 0.14, h: 0.3 },
          { x: 0.9, w: 0.12, h: 0.38 },
        ];
        for (const b of farBuildings) {
          ctx.fillRect(b.x * w, h - h * b.h, b.w * w, h * b.h);
        }

        // Near skyline layer
        ctx.fillStyle = resolvedTime === "night" ? "#06040c" : resolvedTime === "sunset" ? "#1f071e" : "#0f172a";
        const nearBuildings = [
          { x: 0.04, w: 0.1, h: 0.25 },
          { x: 0.16, w: 0.09, h: 0.36 },
          { x: 0.28, w: 0.12, h: 0.22 },
          { x: 0.44, w: 0.09, h: 0.38 },
          { x: 0.58, w: 0.11, h: 0.26 },
          { x: 0.72, w: 0.1, h: 0.34 },
          { x: 0.85, w: 0.12, h: 0.22 },
        ];
        for (const b of nearBuildings) {
          ctx.fillRect(b.x * w, h - h * b.h, b.w * w, h * b.h);
        }

        // Lit pixel windows (visible when dusk/night/sunset)
        if (resolvedTime === "night" || resolvedTime === "dusk" || resolvedTime === "sunset") {
          const windowColors = ["#fef08a", "#67e8f9", "#f472b6", css(ink, 0.9)];
          for (let i = 0; i < nearBuildings.length; i++) {
            const b = nearBuildings[i];
            const bx = b.x * w + 4;
            const by = h - h * b.h + 6;
            const bw = b.w * w - 8;
            const bh = h * b.h - 10;
            if (bw > 6 && bh > 8) {
              for (let wx = 0; wx < bw - 4; wx += 7) {
                for (let wy = 0; wy < bh - 4; wy += 9) {
                  if ((i * 7 + wx * 3 + wy * 5) % 3 === 0) {
                    ctx.fillStyle = windowColors[(wx + wy + i) % windowColors.length];
                    ctx.fillRect(bx + wx, by + wy, 2.5, 3);
                  }
                }
              }
            }
          }

          // Antenna beacon flashing in accent color
          const antX = (0.44 + 0.045) * w;
          const antY = h - h * 0.38;
          ctx.strokeStyle = "rgba(255, 255, 255, 0.4)";
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(antX, antY);
          ctx.lineTo(antX, antY - 10);
          ctx.stroke();

          const beaconPulse = Math.sin(t * 5) > 0.4;
          if (beaconPulse) {
            ctx.fillStyle = css(ink, 0.95);
            ctx.beginPath();
            ctx.arc(antX, antY - 10, 1.8, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      } else if (cfg.horizon === "ocean") {
        // Open oceanic water: two fluid translucent rolling swell layers (no dark ground cliff!)
        const oceanGrad = ctx.createLinearGradient(0, h * 0.72, 0, h);
        if (resolvedTime === "night") {
          oceanGrad.addColorStop(0, "rgba(8, 30, 58, 0.65)");
          oceanGrad.addColorStop(1, "rgba(3, 14, 30, 0.92)");
        } else if (resolvedTime === "sunset") {
          oceanGrad.addColorStop(0, "rgba(95, 25, 75, 0.65)");
          oceanGrad.addColorStop(1, "rgba(35, 8, 30, 0.92)");
        } else {
          oceanGrad.addColorStop(0, "rgba(14, 116, 185, 0.7)");
          oceanGrad.addColorStop(1, "rgba(3, 60, 110, 0.92)");
        }

        // Swell layer 1
        ctx.fillStyle = oceanGrad;
        ctx.beginPath();
        const yBase1 = h * 0.76;
        ctx.moveTo(0, h);
        for (let x = 0; x <= w; x += 12) {
          const y = yBase1 + Math.sin(x * 0.02 + t * 1.8) * 4;
          ctx.lineTo(x, y);
        }
        ctx.lineTo(w, h);
        ctx.closePath();
        ctx.fill();

        // Fore rolling wave layer 2
        const foreGrad = ctx.createLinearGradient(0, h * 0.82, 0, h);
        if (resolvedTime === "night") {
          foreGrad.addColorStop(0, "rgba(14, 52, 95, 0.85)");
          foreGrad.addColorStop(1, "rgba(4, 18, 38, 0.98)");
        } else if (resolvedTime === "sunset") {
          foreGrad.addColorStop(0, "rgba(130, 35, 90, 0.85)");
          foreGrad.addColorStop(1, "rgba(45, 10, 38, 0.98)");
        } else {
          foreGrad.addColorStop(0, "rgba(6, 148, 220, 0.85)");
          foreGrad.addColorStop(1, "rgba(2, 75, 135, 0.98)");
        }

        ctx.fillStyle = foreGrad;
        ctx.beginPath();
        const yBase2 = h * 0.82;
        ctx.moveTo(0, h);
        for (let x = 0; x <= w; x += 10) {
          const y = yBase2 + Math.sin(x * 0.025 - t * 2.2) * 5 + Math.cos(x * 0.04 + t) * 2;
          ctx.lineTo(x, y);
        }
        ctx.lineTo(w, h);
        ctx.closePath();
        ctx.fill();

        // Wave crest foam highlight
        ctx.strokeStyle = resolvedTime === "night" ? "rgba(160, 220, 255, 0.5)" : "rgba(255, 255, 255, 0.75)";
        ctx.lineWidth = 1.3;
        ctx.beginPath();
        for (let x = 0; x <= w; x += 10) {
          const y = yBase2 + Math.sin(x * 0.025 - t * 2.2) * 5 + Math.cos(x * 0.04 + t) * 2;
          if (x === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
      }

      // --- 6. LAYER 4: PRECIPITATION & WEATHER PARTICLES ---
      // Drifting Clouds / Volumetric Rolling Fog Blanket
      if (cloudsLevel !== "clear") {
        let fogRgb: RGB = [210, 225, 240];
        if (resolvedTime === "night") fogRgb = [140, 165, 195];
        else if (resolvedTime === "sunset") fogRgb = [255, 175, 140];
        else if (resolvedTime === "dawn") fogRgb = [225, 185, 215];
        else if (resolvedTime === "dusk") fogRgb = [130, 140, 185];

        if (cloudsLevel === "fog") {
          // Continuous, layered rolling ground mist blanket (no isolated dots!)
          // 1. Ambient bottom mist gradient
          const mistGrad = ctx.createLinearGradient(0, h * 0.42, 0, h);
          mistGrad.addColorStop(0, css(fogRgb, 0));
          mistGrad.addColorStop(0.5, css(fogRgb, 0.16));
          mistGrad.addColorStop(1, css(fogRgb, 0.36));
          ctx.fillStyle = mistGrad;
          ctx.fillRect(0, h * 0.42, w, h * 0.58);

          // 2. Drifting wispy mist ribbons (smooth multi-octave harmonic waves)
          const ribbonCount = 3;
          for (let r = 0; r < ribbonCount; r++) {
            const yBase = h * (0.62 + r * 0.12);
            const speed = (0.2 + r * 0.12) * TS;
            const alpha = 0.12 - r * 0.025;

            ctx.fillStyle = css(fogRgb, Math.max(0.04, alpha));
            ctx.beginPath();
            ctx.moveTo(0, h);
            for (let x = 0; x <= w; x += 10) {
              const y =
                yBase +
                Math.sin(x * 0.012 + t * speed + r * 2.2) * 7 +
                Math.cos(x * 0.024 - t * speed * 0.8) * 4;
              ctx.lineTo(x, y);
            }
            ctx.lineTo(w, h);
            ctx.closePath();
            ctx.fill();
          }
        } else {
          // Overhead drifting soft cloud banks (wide horizontal volumetric wisps)
          const isOvercast = cloudsLevel === "overcast";
          const maxPuffs = isOvercast ? 4 : 2;
          const baseAlpha = isOvercast ? 0.28 : 0.15;

          if (isOvercast) {
            ctx.fillStyle = css(fogRgb, 0.12);
            ctx.fillRect(0, 0, w, h);
          }

          for (let i = 0; i < maxPuffs; i++) {
            const speed = (8 + i * 4) * TS;
            const cx = ((t * speed + i * (w / maxPuffs) * 1.4) % (w * 1.8)) - w * 0.4;
            const cy = h * (0.15 + i * 0.12);
            const rx = Math.max(85, w * 0.26);
            const ry = Math.max(22, h * 0.12);

            ctx.save();
            ctx.translate(cx, cy);
            ctx.scale(1, ry / rx);

            const g = ctx.createRadialGradient(0, 0, 0, 0, 0, rx);
            g.addColorStop(0, css(fogRgb, baseAlpha));
            g.addColorStop(0.55, css(fogRgb, baseAlpha * 0.45));
            g.addColorStop(1, css(fogRgb, 0));
            ctx.fillStyle = g;
            ctx.beginPath();
            ctx.arc(0, 0, rx, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
          }
        }
      }

      // Rain
      if (rainLevel !== "off") {
        // Bottom wet puddle reflection in accent
        const puddle = ctx.createLinearGradient(0, h - 28, 0, h);
        puddle.addColorStop(0, "rgba(0, 0, 0, 0)");
        puddle.addColorStop(1, css(ink, rainLevel === "heavy" ? 0.22 : 0.14));
        ctx.fillStyle = puddle;
        ctx.fillRect(0, h - 28, w, 28);

        // Static condensation beads on glass
        const activeBeads = Math.max(10, Math.min(condensationBeads.length, Math.floor(w / 18)));
        for (let i = 0; i < activeBeads; i++) {
          const bead = condensationBeads[i];
          ctx.fillStyle = `rgba(225, 240, 255, ${bead.alpha})`;
          ctx.beginPath();
          ctx.arc(bead.x * w, bead.y * h, bead.r, 0, Math.PI * 2);
          ctx.fill();
        }

        // Slanted fluid rain streaks (calibrated for high visibility in open spaces between cards)
        const multiplier = rainLevel === "heavy" ? 1.4 : rainLevel === "light" ? 0.55 : 0.9;
        const activeDrops = Math.max(
          rainLevel === "light" ? 28 : 45,
          Math.min(rainDrops.length, Math.floor((w / 7.5) * multiplier))
        );
        const wind = rainLevel === "heavy" ? -0.18 : -0.1;

        for (let i = 0; i < activeDrops; i++) {
          const drop = rainDrops[i];
          const speedFactor = rainLevel === "heavy" ? 0.022 : rainLevel === "medium" ? 0.017 : 0.013;
          drop.y += (drop.speed * (speedFactor + (cfg.audioReactive ? loud * 0.01 : 0))) * TS;
          if (drop.y > 1.15) {
            drop.y = -0.1;
            drop.x = Math.random();
          }
          const px = drop.x * w;
          const py = drop.y * h;
          const len = Math.min(h * 0.35, drop.len * (rainLevel === "heavy" ? 1.4 : rainLevel === "medium" ? 1.1 : 0.85));

          const dropGrad = ctx.createLinearGradient(px, py, px + len * wind, py + len);
          dropGrad.addColorStop(0, "rgba(180, 215, 255, 0)");
          dropGrad.addColorStop(0.35, `rgba(180, 215, 255, ${drop.alpha * 0.6})`);
          dropGrad.addColorStop(1, `rgba(230, 245, 255, ${drop.alpha * 1.1})`);

          ctx.strokeStyle = dropGrad;
          ctx.lineWidth = rainLevel === "heavy" ? 1.8 : rainLevel === "medium" ? 1.4 : 1.1;
          ctx.lineCap = "round";
          ctx.beginPath();
          ctx.moveTo(px, py);
          ctx.lineTo(px + len * wind, py + len);
          ctx.stroke();
        }
      }

      // Snow
      if (snowLevel !== "off") {
        const count = snowLevel === "heavy" ? Math.min(snowflakes.length, Math.floor(w / 14)) : Math.min(25, Math.floor(w / 28));
        for (let i = 0; i < count; i++) {
          const fl = snowflakes[i];
          fl.y += fl.speed * 0.008 * TS;
          if (fl.y > 1.1) {
            fl.y = -0.05;
            fl.x = Math.random();
          }
          const px = (fl.x + Math.sin(t * 1.5 + fl.seed) * 0.04) * w;
          const py = fl.y * h;
          ctx.fillStyle = `rgba(255, 255, 255, ${fl.alpha})`;
          ctx.beginPath();
          ctx.arc(px, py, fl.r, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // Wind & Falling Leaves
      if (windLeaves) {
        const numLeaves = Math.max(4, Math.min(leaves.length, Math.floor(w / 28)));
        for (let i = 0; i < numLeaves; i++) {
          const lf = leaves[i];
          lf.x += lf.vx * 0.006 * TS;
          lf.y += (lf.vy + Math.sin(t * 2 + i) * 0.004) * TS;
          lf.rot += lf.vrot;
          if (lf.x > 1.1 || lf.y > 1.1) {
            lf.x = -0.1;
            lf.y = Math.random() * 0.6;
          }
          const px = lf.x * w;
          const py = lf.y * h;
          ctx.save();
          ctx.translate(px, py);
          ctx.rotate(lf.rot);
          ctx.fillStyle = lf.color;
          ctx.beginPath();
          ctx.ellipse(0, 0, lf.size, lf.size * 0.45, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }
      }

      // Thunder & Lightning Flash
      const lightningTrigger = thunder && (Math.sin(t * 0.15) > 0.98 || (cfg.audioReactive && loud > 0.85));
      if (lightningTrigger) {
        ctx.fillStyle = "rgba(220, 235, 255, 0.45)";
        ctx.fillRect(0, 0, w, h);
      }

      frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(frame);
      off?.();
    };
  }, [cfg, forecast, playing]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className="pointer-events-none absolute inset-0 z-0 h-full w-full"
      style={{ borderRadius: radius }}
    />
  );
}
