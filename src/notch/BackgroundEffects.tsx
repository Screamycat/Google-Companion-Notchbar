import { useEffect, useRef } from "react";
import { audioLevelsAvailable, subscribeLevels, type Levels } from "../platform/audio";
import { settings, type AppearanceEffect } from "../settings/store";
import { DynamicWorldScene } from "./DynamicWorldScene";

/*
 * Background effects for the notch: responsive Canvas 2D and pure CSS scenes
 * that adapt to any island dimensions without stretching.
 * Mounted only while an effect is picked; rAF and audio subscriptions clean up on unmount.
 */

type RGB = [number, number, number];

function parseRgb(css: string): RGB {
  const m = css.match(/rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)/);
  if (!m) return [255, 69, 58];
  return [Math.min(255, +m[1]), Math.min(255, +m[2]), Math.min(255, +m[3])];
}

function css(c: RGB, a = 1): string {
  return `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`;
}

function mix(a: RGB, b: RGB, k: number): RGB {
  return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];
}

function shiftHue([r, g, b]: RGB, deg: number): RGB {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [r * 255, g * 255, b * 255];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = (max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4) * 60;
  h = (((h + deg) % 360) + 360) % 360;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  const [pr, pg, pb] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  return [(pr + m) * 255, (pg + m) * 255, (pb + m) * 255];
}

export function BackgroundEffects({ effect, playing, radius }: { effect: AppearanceEffect; playing: boolean; radius: number }) {
  if (effect === "none") return null;
  if (effect === "dynamic-world") return <DynamicWorldScene playing={playing} radius={radius} />;
  if (effect === "synthwave") return <SynthwaveScene radius={radius} />;
  if (effect === "nightsky") return <NightSky radius={radius} />;
  if (effect === "treehouse") return <TreehouseScene radius={radius} />;
  if (effect === "circuits" || effect === "bmo-retro") return <CircuitsScene radius={radius} />;
  if (effect === "pixel-skyline") return <PixelSkylineScene radius={radius} />;
  if (effect === "custom-image") return <CustomWallpaperScene radius={radius} />;
  return <LiveCanvas effect={effect} playing={playing} radius={radius} />;
}

const MIN_FRAME_MS = 14;
const ATTACK = 0.045;
const RELEASE = 0.14;
const BARS = 28;

function LiveCanvas({
  effect,
  playing,
  radius,
}: {
  effect: AppearanceEffect;
  playing: boolean;
  radius: number;
}) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    const TS = matchMedia("(prefers-reduced-motion: reduce)").matches ? 0.3 : 1;

    const readBase = (): RGB => parseRgb(getComputedStyle(canvas).getPropertyValue("--accent") || "#4285f4");
    const lerpTo = (cur: RGB, tgt: RGB, k: number): RGB => [
      cur[0] + (tgt[0] - cur[0]) * k,
      cur[1] + (tgt[1] - cur[1]) * k,
      cur[2] + (tgt[2] - cur[2]) * k,
    ];

    // Responsive Canvas Sizing (fixes non-uniform stretching!)
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

    // State for procedural generators
    // 1. Rainy window particles (linear density scales with width)
    const rainDrops = Array.from({ length: 48 }, () => ({
      x: Math.random(),
      y: Math.random(),
      speed: 0.35 + Math.random() * 0.65,
      len: 10 + Math.random() * 18,
      alpha: 0.2 + Math.random() * 0.45,
    }));

    // Soft static condensation droplets on the glass
    const condensationBeads = Array.from({ length: 24 }, () => ({
      x: Math.random(),
      y: Math.random(),
      r: 1.1 + Math.random() * 1.5,
      alpha: 0.12 + Math.random() * 0.25,
    }));

    // 2. Fireplace embers
    const embers = Array.from({ length: 36 }, () => ({
      x: 0.5 + (Math.random() - 0.5) * 0.65,
      y: 0.85 + Math.random() * 0.2,
      vx: (Math.random() - 0.5) * 0.08,
      vy: -(0.18 + Math.random() * 0.38),
      size: 1.2 + Math.random() * 2.2,
      life: Math.random(),
    }));

    // 3. Matrix rain drops (columns scale with physical width)
    const matrixCols = Array.from({ length: 44 }, () => ({
      y: Math.random() * -120,
      speed: 1.2 + Math.random() * 2.2,
      len: 5 + Math.floor(Math.random() * 10),
    }));

    // 4. Warp Starfield
    const warpStars = Array.from({ length: 75 }, () => ({
      x: (Math.random() - 0.5) * 2,
      y: (Math.random() - 0.5) * 2,
      z: 0.05 + Math.random() * 0.95,
      pz: 1,
    }));

    const draw = (t: number, loud: number, ink: RGB, bands: number[] | null, w: number, h: number) => {
      ctx.clearRect(0, 0, w, h);

      if (effect === "visualizer") {
        const grad = ctx.createLinearGradient(0, h, 0, h * 0.25);
        grad.addColorStop(0, css(ink, 0.9));
        grad.addColorStop(1, css(ink, 0.05));
        ctx.fillStyle = grad;
        const bw = w / BARS;
        for (let i = 0; i < BARS; i++) {
          const barH = Math.max(3, (bands ? bands[i] : 0.2) * h * 0.72);
          ctx.fillRect(i * bw + 1.5, h - barH, Math.max(1, bw - 3), barH);
        }
      } else if (effect === "ambient") {
        ctx.globalCompositeOperation = "lighter";
        const cols = [ink, shiftHue(ink, 45), shiftHue(ink, -40)];
        for (let k = 0; k < 3; k++) {
          const cx = w * (0.5 + 0.3 * Math.sin(t * (0.35 + k * 0.13) + k * 2.1));
          const cy = h * (0.44 + 0.22 * Math.cos(t * (0.28 + k * 0.11) + k * 1.3));
          const r = Math.min(w, h) * 0.45 * (0.85 + 0.5 * loud) + k * 20;
          const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
          g.addColorStop(0, css(cols[k], 0.5));
          g.addColorStop(1, css(cols[k], 0));
          ctx.fillStyle = g;
          ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
        }
        ctx.globalCompositeOperation = "source-over";
      } else if (effect === "waves") {
        const cols = [shiftHue(ink, -30), ink, mix(ink, [255, 255, 255], 0.35)];
        const baseY = h * 0.62;
        cols.forEach((c, k) => {
          const amp = (18 + k * 10) * (0.55 + 0.9 * loud);
          ctx.beginPath();
          ctx.moveTo(0, h);
          for (let x = 0; x <= w; x += 10) {
            ctx.lineTo(
              x,
              baseY - k * 20 + Math.sin((x / Math.max(w, 1)) * Math.PI * (2 + k) + t * (0.9 + k * 0.35) + k * 2.1) * amp
            );
          }
          ctx.lineTo(w, h);
          ctx.closePath();
          ctx.fillStyle = css(c, 0.3 - k * 0.07);
          ctx.fill();
        });
      } else if (effect === "aurora") {
        const wash = ctx.createLinearGradient(0, 0, 0, h);
        wash.addColorStop(0, css(mix(ink, [180, 255, 220], 0.25), 0.5 + 0.3 * loud));
        wash.addColorStop(0.45, css(ink, 0.22 + 0.25 * loud));
        wash.addColorStop(1, css(ink, 0));
        ctx.fillStyle = wash;
        ctx.fillRect(0, 0, w, h);
        ctx.globalCompositeOperation = "lighter";
        const cols = [mix(ink, [255, 255, 255], 0.3), shiftHue(ink, 50)];
        for (let k = 0; k < 2; k++) {
          const baseX = w * (0.35 + k * 0.3);
          const sway = 24 * (0.5 + loud);
          const grad = ctx.createLinearGradient(0, 0, 0, h * 0.7);
          grad.addColorStop(0, css(cols[k], 0.35 + 0.3 * loud));
          grad.addColorStop(1, css(cols[k], 0));
          ctx.fillStyle = grad;
          ctx.beginPath();
          ctx.moveTo(baseX - 40, 0);
          for (let y = 0; y <= h * 0.7; y += 14) {
            ctx.lineTo(baseX - 40 + Math.sin((y / Math.max(h, 1)) * Math.PI * 2.4 + t * (0.6 + k * 0.3) + k * 2.6) * sway, y);
          }
          for (let y = h * 0.7; y >= 0; y -= 14) {
            ctx.lineTo(baseX + 40 + Math.sin((y / Math.max(h, 1)) * Math.PI * 2.4 + t * (0.6 + k * 0.3) + k * 2.6 + 1) * sway, y);
          }
          ctx.closePath();
          ctx.fill();
        }
        ctx.globalCompositeOperation = "source-over";
        ctx.fillStyle = "rgba(255, 255, 255, 0.5)";
        for (let i = 0; i < 24; i++) {
          const sx = (i * 197.3) % w;
          const sy = h * 0.5 + ((i * 331.7) % (h * 0.5));
          ctx.globalAlpha = 0.3 + 0.35 * (0.5 + 0.5 * Math.sin(t * 1.5 + i * 1.7));
          ctx.fillRect(sx, sy, 1.5, 1.5);
        }
        ctx.globalAlpha = 1;
      } else if (effect === "holographic") {
        ctx.fillStyle = "#0b0a16";
        ctx.fillRect(0, 0, w, h);
        ctx.globalCompositeOperation = "lighter";
        const drift = (t * 24) % (w * 1.6);
        const sheen: Array<[number, RGB]> = [
          [0.15, shiftHue(ink, 120)],
          [0.38, shiftHue(ink, 60)],
          [0.62, ink],
          [0.85, shiftHue(ink, -70)],
        ];
        for (const [p, c] of sheen) {
          const x = ((p * w * 1.6 + drift) % (w * 1.6)) - w * 0.3;
          const g = ctx.createLinearGradient(x, 0, x + 160, h);
          g.addColorStop(0, css(c, 0));
          g.addColorStop(0.5, css(c, 0.34));
          g.addColorStop(1, css(c, 0));
          ctx.fillStyle = g;
          ctx.fillRect(0, 0, w, h);
        }
        const sx = ((t * 60) % (w + 400)) - 200;
        const shine = ctx.createLinearGradient(sx - 50, 0, sx + 50, 0);
        shine.addColorStop(0, "rgba(255, 255, 255, 0)");
        shine.addColorStop(0.5, "rgba(255, 255, 255, 0.12)");
        shine.addColorStop(1, "rgba(255, 255, 255, 0)");
        ctx.fillStyle = shine;
        ctx.fillRect(0, 0, w, h);
        ctx.globalCompositeOperation = "source-over";
      } else if (effect === "topographic") {
        ctx.fillStyle = "#070604";
        ctx.fillRect(0, 0, w, h);
        ctx.lineWidth = 1.4;
        for (let k = 0; k < 10; k++) {
          const cx = w * 0.5 + 36 * Math.sin(t * 0.2 + k * 0.9);
          const cy = h * 0.55 + 24 * Math.cos(t * 0.16 + k * 1.7);
          const R = 28 + k * 22;
          ctx.strokeStyle = css(mix(ink, [255, 200, 120], 0.25), 0.55 - k * 0.04);
          ctx.beginPath();
          for (let s = 0; s <= 60; s++) {
            const a = (s / 60) * Math.PI * 2 + t * 0.05 * (k % 2 === 0 ? 1 : -1);
            const wob = 8 * Math.sin(3 * a + t * 0.5 + k * 1.3) + 4 * Math.sin(5 * a - t * 0.34 + k);
            const x = cx + Math.cos(a) * (R + wob);
            const y = cy + Math.sin(a) * (R + wob) * 0.72;
            if (s === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
          }
          ctx.closePath();
          ctx.stroke();
        }
      } else if (effect === "rainy-window") {
        // Deep misty rain over dusk glass with subtle accent puddle glow
        const bg = ctx.createLinearGradient(0, 0, 0, h);
        bg.addColorStop(0, "#080c16");
        bg.addColorStop(0.7, "#0f1624");
        bg.addColorStop(1, css(mix([15, 24, 38], ink, 0.18), 0.95));
        ctx.fillStyle = bg;
        ctx.fillRect(0, 0, w, h);

        // Accent reflection in the wet glass base
        const puddle = ctx.createLinearGradient(0, h - 26, 0, h);
        puddle.addColorStop(0, "rgba(0, 0, 0, 0)");
        puddle.addColorStop(1, css(ink, 0.12 + loud * 0.1));
        ctx.fillStyle = puddle;
        ctx.fillRect(0, h - 26, w, 26);

        // Distant lightning flash on heavy audio peak
        if (loud > 0.82) {
          ctx.fillStyle = css(mix([200, 225, 255], ink, 0.3), (loud - 0.82) * 0.55);
          ctx.fillRect(0, 0, w, h);
        }

        // Soft static condensation droplets resting on the glass
        const activeBeads = Math.max(4, Math.min(condensationBeads.length, Math.floor(w / 35)));
        for (let i = 0; i < activeBeads; i++) {
          const bead = condensationBeads[i];
          const bx = bead.x * w;
          const by = bead.y * h;
          ctx.fillStyle = `rgba(255, 255, 255, ${bead.alpha})`;
          ctx.beginPath();
          ctx.arc(bx, by, bead.r, 0, Math.PI * 2);
          ctx.fill();
        }

        // Linear rain streaks: density scales naturally with width (never super-tight in Peek!)
        const activeDrops = Math.max(4, Math.min(rainDrops.length, Math.floor(w / 34)));
        const wind = -0.12;

        for (let i = 0; i < activeDrops; i++) {
          const drop = rainDrops[i];
          drop.y += (drop.speed * (0.012 + loud * 0.008)) * TS;
          if (drop.y > 1.15) {
            drop.y = -0.1;
            drop.x = Math.random();
          }
          const px = drop.x * w;
          const py = drop.y * h;
          // Clamp length so streaks don't drown narrow island bars like Peek (48px)
          const len = Math.min(h * 0.32, drop.len * (0.8 + loud * 0.35));

          const dropGrad = ctx.createLinearGradient(px, py, px + len * wind, py + len);
          dropGrad.addColorStop(0, "rgba(180, 215, 255, 0)");
          dropGrad.addColorStop(0.35, `rgba(180, 215, 255, ${drop.alpha * 0.5})`);
          dropGrad.addColorStop(1, `rgba(220, 240, 255, ${drop.alpha * 1.1})`);

          ctx.strokeStyle = dropGrad;
          ctx.lineWidth = 1.2;
          ctx.lineCap = "round";
          ctx.beginPath();
          ctx.moveTo(px, py);
          ctx.lineTo(px + len * wind, py + len);
          ctx.stroke();
        }
      } else if (effect === "cozy-fireplace") {
        // Dark cozy hearth stone subtly warmed by accent hue
        const bg = ctx.createRadialGradient(w * 0.5, h, 0, w * 0.5, h, Math.max(w * 0.6, h));
        bg.addColorStop(0, css(mix([90, 25, 8], ink, 0.2), 0.85));
        bg.addColorStop(0.5, "rgba(35, 12, 5, 0.95)");
        bg.addColorStop(1, "#070403");
        ctx.fillStyle = bg;
        ctx.fillRect(0, 0, w, h);

        // Warm pulsing flame core (proportional to island height)
        const pulse = 1 + 0.15 * Math.sin(t * 4.2) + loud * 0.35;
        const flameRadius = Math.min(w * 0.38, h * 0.85) * pulse;
        const flame = ctx.createRadialGradient(w * 0.5, h * 0.98, 0, w * 0.5, h * 0.98, flameRadius);
        flame.addColorStop(0, css(mix([255, 210, 90], ink, 0.22), 0.55));
        flame.addColorStop(0.4, "rgba(255, 90, 20, 0.32)");
        flame.addColorStop(1, "rgba(255, 40, 0, 0)");
        ctx.fillStyle = flame;
        ctx.fillRect(0, 0, w, h);

        // Rising hearth embers (count & size scale with viewport)
        const activeEmbers = Math.max(6, Math.min(embers.length, Math.floor(w / 18)));
        ctx.globalCompositeOperation = "lighter";
        for (let i = 0; i < activeEmbers; i++) {
          const ember = embers[i];
          ember.y += ember.vy * 0.016 * TS;
          ember.x += (ember.vx + Math.sin(t * 2 + ember.life * 6) * 0.02) * 0.016 * TS;
          ember.life -= 0.012 * TS;
          if (ember.life <= 0 || ember.y < 0) {
            ember.life = 1;
            ember.y = 0.9 + Math.random() * 0.15;
            ember.x = 0.5 + (Math.random() - 0.5) * 0.55;
          }
          const px = ember.x * w;
          const py = ember.y * h;
          const alpha = Math.sin(ember.life * Math.PI) * (0.35 + loud * 0.45);
          const r = Math.max(0.9, ember.size * Math.min(1, h / 120));

          ctx.fillStyle =
            ember.life > 0.55
              ? css(mix([255, 215, 80], ink, 0.2), alpha)
              : css(mix([255, 80, 20], ink, 0.25), alpha);
          ctx.beginPath();
          ctx.arc(px, py, r, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.globalCompositeOperation = "source-over";
      } else if (effect === "matrix-rain") {
        // Deep obsidian background
        ctx.fillStyle = "rgba(4, 9, 6, 0.96)";
        ctx.fillRect(0, 0, w, h);

        ctx.font = "11px monospace";
        const chars = "0123456789ABCDEFｦｱｳｴｵｶｷｹｺｻｼｽｾｿﾀﾂﾃﾅﾆﾇﾈﾊﾋﾎﾏﾐﾑﾒﾓﾔﾕﾗﾘﾜ";

        // Fixed physical column spacing so glyphs NEVER overlap horizontally
        const colW = 16;
        const numCols = Math.max(5, Math.min(matrixCols.length, Math.floor(w / colW)));
        const xStart = (w - numCols * colW) * 0.5;
        const maxLen = Math.max(3, Math.floor(h / 13));

        for (let i = 0; i < numCols; i++) {
          const col = matrixCols[i];
          const x = xStart + i * colW + 4;
          col.y += (col.speed * (1 + loud * 1.5)) * TS;
          const trailLen = Math.min(col.len, maxLen);
          if (col.y > h + trailLen * 14) {
            col.y = -Math.random() * 60;
          }

          for (let j = 0; j < trailLen; j++) {
            const py = col.y - j * 13;
            if (py < 0 || py > h) continue;
            const ch = chars[(Math.floor(i * 7 + j * 13 + t * 4)) % chars.length];
            if (j === 0) {
              // Glowing head character shimmers in the user's accent color
              ctx.fillStyle = css(mix([235, 255, 245], ink, 0.45), 0.95);
              ctx.fillText(ch, x, py);
            } else {
              const alpha = Math.max(0, (1 - j / trailLen) * 0.68);
              ctx.fillStyle = `rgba(0, 255, 100, ${alpha})`;
              ctx.fillText(ch, x, py);
            }
          }
        }
      } else if (effect === "warp-starfield") {
        ctx.fillStyle = "#030308";
        ctx.fillRect(0, 0, w, h);

        const cx = w * 0.5;
        const cy = h * 0.5;
        const speed = (0.012 + loud * 0.045) * TS;
        const numStars = Math.max(22, Math.min(warpStars.length, Math.floor(w / 5)));

        ctx.lineCap = "round";

        for (let i = 0; i < numStars; i++) {
          const star = warpStars[i];
          star.pz = star.z;
          star.z -= speed;
          if (star.z <= 0) {
            star.z = 1;
            star.pz = 1;
            star.x = (Math.random() - 0.5) * 2;
            star.y = (Math.random() - 0.5) * 2;
          }

          const k = Math.min(w, h) * 0.7;
          const sx = cx + (star.x / star.z) * k;
          const sy = cy + (star.y / star.z) * k;
          const px = cx + (star.x / star.pz) * k;
          const py = cy + (star.y / star.pz) * k;

          if (sx < 0 || sx > w || sy < 0 || sy > h) continue;

          const alpha = (1 - star.z) * 0.85;
          // Hyperspace warp trails shift toward accent color on energy peaks
          const trailColor = loud > 0.25 ? mix([210, 235, 255], ink, Math.min(1, loud * 1.5)) : [255, 255, 255];
          ctx.strokeStyle = css(trailColor as RGB, alpha);
          ctx.lineWidth = Math.max(1, (1 - star.z) * (loud > 0.4 ? 2.6 : 1.6));

          ctx.beginPath();
          ctx.moveTo(px, py);
          ctx.lineTo(sx, sy);
          ctx.stroke();
        }
      } else if (effect === "chromatic-prism") {
        // Frosted obsidian glass
        ctx.fillStyle = "#06070d";
        ctx.fillRect(0, 0, w, h);

        // Smooth continuous sinusoidal wave phase - ZERO modulo jump, 100% stable on tab switch/resizing!
        const p1 = 0.5 + 0.38 * Math.sin(t * 0.32);
        const p2 = 0.5 + 0.34 * Math.cos(t * 0.26 + 1.1);
        const cx1 = p1 * w;
        const cx2 = p2 * w;

        const beamW1 = Math.max(70, w * 0.26);
        const beamW2 = Math.max(90, w * 0.32);

        // Prismatic dispersion colors centered on the user's accent color
        const cWarm = shiftHue(ink, -35);
        const cCool = shiftHue(ink, 35);
        const cGold = shiftHue(ink, -70);
        const cViolet = shiftHue(ink, 70);

        ctx.globalCompositeOperation = "lighter";

        // Primary dispersion ribbon
        const g1 = ctx.createLinearGradient(cx1 - beamW1, 0, cx1 + beamW1, h);
        g1.addColorStop(0, "rgba(0, 0, 0, 0)");
        g1.addColorStop(0.2, css(cWarm, 0.16 + loud * 0.14));
        g1.addColorStop(0.42, css(ink, 0.3 + loud * 0.22));
        g1.addColorStop(0.65, css(cCool, 0.2 + loud * 0.16));
        g1.addColorStop(0.85, css(cViolet, 0.14 + loud * 0.1));
        g1.addColorStop(1, "rgba(0, 0, 0, 0)");
        ctx.fillStyle = g1;
        ctx.fillRect(Math.max(0, cx1 - beamW1), 0, beamW1 * 2, h);

        // Secondary soft ambient refraction
        const g2 = ctx.createLinearGradient(cx2 - beamW2, h, cx2 + beamW2, 0);
        g2.addColorStop(0, "rgba(0, 0, 0, 0)");
        g2.addColorStop(0.25, css(cGold, 0.1 + loud * 0.08));
        g2.addColorStop(0.5, css(ink, 0.18 + loud * 0.14));
        g2.addColorStop(0.75, css(cCool, 0.12 + loud * 0.08));
        g2.addColorStop(1, "rgba(0, 0, 0, 0)");
        ctx.fillStyle = g2;
        ctx.fillRect(Math.max(0, cx2 - beamW2), 0, beamW2 * 2, h);

        ctx.globalCompositeOperation = "source-over";
      } else if (effect === "celestial-nebula") {
        ctx.fillStyle = "#04030a";
        ctx.fillRect(0, 0, w, h);

        ctx.globalCompositeOperation = "lighter";
        const cCool = shiftHue(ink, 40);
        const cViolet = shiftHue(ink, -40);

        // Volumetric dust clouds powered by the user's signature accent color
        const clouds = [
          { color: `${ink[0]}, ${ink[1]}, ${ink[2]}`, cx: w * 0.45, cy: h * 0.5, r: Math.min(w, h) * 0.8 },
          { color: `${cViolet[0]}, ${cViolet[1]}, ${cViolet[2]}`, cx: w * 0.72, cy: h * 0.55, r: Math.min(w, h) * 0.65 },
          { color: `${cCool[0]}, ${cCool[1]}, ${cCool[2]}`, cx: w * 0.25, cy: h * 0.65, r: Math.min(w, h) * 0.6 },
        ];

        for (let i = 0; i < clouds.length; i++) {
          const c = clouds[i];
          const ox = Math.sin(t * 0.25 + i * 2) * 22;
          const oy = Math.cos(t * 0.22 + i * 1.5) * 16;
          const g = ctx.createRadialGradient(c.cx + ox, c.cy + oy, 0, c.cx + ox, c.cy + oy, c.r * (1 + loud * 0.25));
          g.addColorStop(0, `rgba(${c.color}, 0.3)`);
          g.addColorStop(0.5, `rgba(${c.color}, 0.12)`);
          g.addColorStop(1, `rgba(${c.color}, 0)`);
          ctx.fillStyle = g;
          ctx.fillRect(0, 0, w, h);
        }
        ctx.globalCompositeOperation = "source-over";

        // Twinkling stardust (scaled by width)
        const starCount = Math.max(10, Math.min(30, Math.floor(w / 18)));
        ctx.fillStyle = "rgba(255, 255, 255, 0.65)";
        for (let i = 0; i < starCount; i++) {
          const sx = (i * 241.7) % w;
          const sy = (i * 179.3) % h;
          const alpha = 0.2 + 0.55 * Math.abs(Math.sin(t * 1.4 + i));
          ctx.globalAlpha = alpha;
          ctx.fillRect(sx, sy, 1.4, 1.4);
        }
        ctx.globalAlpha = 1;
      }
    };

    let frame = 0;
    let last = performance.now();
    let n = 0;
    let live: { values: Levels; at: number } | null = null;
    const off = playing && audioLevelsAvailable ? subscribeLevels((values) => (live = { values, at: performance.now() })) : null;
    const shown = readBase();
    let target = shown;
    const vals = new Array<number>(BARS).fill(0.2);

    const tick = (now: number) => {
      if (now - last < MIN_FRAME_MS) {
        frame = requestAnimationFrame(tick);
        return;
      }
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const t = (now / 1000) * TS;
      if (n++ % 30 === 0) target = readBase();
      const k = 1 - Math.exp(-dt / 0.18);
      const ink = lerpTo(shown, target, k);
      shown[0] = ink[0];
      shown[1] = ink[1];
      shown[2] = ink[2];

      const lv = live && now - live.at < 400 ? live.values : null;
      const loud = lv ? Math.max(...lv) : 0.24 + 0.12 * Math.sin(t * 1.3);

      let bands: number[] | null = null;
      if (effect === "visualizer") {
        bands = vals;
        for (let i = 0; i < BARS; i++) {
          const pos = (i / (BARS - 1)) * 3;
          const a = Math.floor(pos);
          const b = Math.min(3, a + 1);
          const v = lv ? lv[a] + (lv[b] - lv[a]) * (pos - a) : 0;
          const goal = lv ? 0.12 + 0.88 * v : 0.14 + 0.5 * Math.sin(t * (5 + i * 1.2));
          const tau = goal > vals[i] ? ATTACK : RELEASE;
          vals[i] += (goal - vals[i]) * (1 - Math.exp(-dt / tau));
        }
      }

      const { w, h } = updateSize();
      draw(t, loud, shown, bands, w, h);
      frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(frame);
      off?.();
    };
  }, [effect, playing]);

  return (
    <canvas
      ref={ref}
      aria-hidden
      className="pointer-events-none absolute inset-0 z-0 h-full w-full"
      style={{ borderRadius: radius }}
    />
  );
}

/** Retro sun and neon grid: aspect-ratio locked with true circular sun! */
function SynthwaveScene({ radius }: { radius: number }) {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 z-0 overflow-hidden" style={{ borderRadius: radius }}>
      <div className="absolute inset-0" style={{ background: "linear-gradient(180deg, #150833 0%, #3d1160 42%, #a12c6d 68%, #1a0b2e 69%, #0d0518 100%)" }} />
      {/* Sun with slits: locked to aspect-square so it never flattens into an ellipse! */}
      <div className="absolute top-[8%] left-1/2 aspect-square w-28 -translate-x-1/2 overflow-hidden rounded-full">
        <div className="absolute inset-0 rounded-full" style={{ background: "linear-gradient(180deg, #ffd60a 0%, #ff9f0a 55%, #ff453a 100%)" }} />
        {[0, 1, 2].map((i) => (
          <div key={i} className="absolute right-0 left-0" style={{ top: `${56 + i * 14}%`, height: 2 + i * 1.5, background: "#3d1160" }} />
        ))}
      </div>
      {/* Neon grid floor anchored to bottom */}
      <div
        className="absolute right-0 bottom-0 left-0 h-[34%]"
        style={{
          background:
            "repeating-linear-gradient(90deg, rgb(224 123 255 / 0.5) 0 1px, transparent 1px 32px), repeating-linear-gradient(0deg, rgb(224 123 255 / 0.5) 0 1px, transparent 1px 14px)",
          maskImage: "linear-gradient(180deg, transparent, #000 45%)",
        }}
      />
      {/* Stars */}
      {[
        [8, 12],
        [22, 6],
        [38, 16],
        [64, 8],
        [78, 18],
        [90, 10],
        [50, 5],
      ].map(([x, y], i) => (
        <div key={i} className="absolute size-[2px] rounded-full bg-white/80" style={{ left: `${x}%`, top: `${y}%` }} />
      ))}
    </div>
  );
}

/** Night sky: dynamically responsive canvas with true circular moon & twinkling stars */
function NightSky({ radius }: { radius: number }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    const TS = matchMedia("(prefers-reduced-motion: reduce)").matches ? 0.3 : 1;

    const stars = Array.from({ length: 80 }, () => ({
      rx: Math.random(),
      ry: Math.random() * 0.75,
      r: 0.6 + Math.random() * 1.4,
      p: Math.random() * Math.PI * 2,
      s: 0.6 + Math.random() * 2.2,
    }));

    const meteors: { x: number; y: number; vx: number; vy: number; life: number }[] = [];
    let nextMeteor = 2;

    const draw = (t: number) => {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = Math.max(10, Math.round(rect.width));
      const h = Math.max(10, Math.round(rect.height));
      if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
        canvas.width = Math.round(w * dpr);
        canvas.height = Math.round(h * dpr);
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const sky = ctx.createLinearGradient(0, 0, 0, h);
      sky.addColorStop(0, "#060a1c");
      sky.addColorStop(0.6, "#0b1030");
      sky.addColorStop(1, "#02030a");
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, w, h);

      // Moon anchored to upper right, true circular radius
      const mr = Math.min(24, Math.max(14, h * 0.14));
      const mx = w - mr * 2.5;
      const my = mr * 1.8;

      const halo = ctx.createRadialGradient(mx, my, 0, mx, my, mr * 3.4);
      halo.addColorStop(0, "rgba(244, 241, 222, 0.32)");
      halo.addColorStop(1, "rgba(244, 241, 222, 0)");
      ctx.fillStyle = halo;
      ctx.fillRect(mx - mr * 3.5, my - mr * 3.5, mr * 7, mr * 7);

      ctx.fillStyle = "#f4f1de";
      ctx.beginPath();
      ctx.arc(mx, my, mr, 0, Math.PI * 2);
      ctx.fill();

      // Moon craters
      ctx.fillStyle = "rgba(190, 186, 160, 0.45)";
      ctx.beginPath();
      ctx.arc(mx - mr * 0.3, my - mr * 0.2, mr * 0.24, 0, Math.PI * 2);
      ctx.arc(mx + mr * 0.25, my + mr * 0.35, mr * 0.16, 0, Math.PI * 2);
      ctx.fill();

      for (const st of stars) {
        ctx.fillStyle = `rgba(255, 255, 255, ${(0.35 + 0.55 * (0.5 + 0.5 * Math.sin(t * st.s + st.p))).toFixed(3)})`;
        ctx.beginPath();
        ctx.arc(st.rx * w, st.ry * h, st.r, 0, Math.PI * 2);
        ctx.fill();
      }

      if (t > nextMeteor) {
        nextMeteor = t + 3 + Math.random() * 5;
        meteors.push({
          x: w * (0.3 + Math.random() * 0.6),
          y: h * Math.random() * 0.3,
          vx: -(220 + Math.random() * 180),
          vy: 130 + Math.random() * 100,
          life: 1,
        });
      }

      for (let i = meteors.length - 1; i >= 0; i--) {
        const m = meteors[i];
        m.life -= 0.03;
        if (m.life <= 0) {
          meteors.splice(i, 1);
          continue;
        }
        m.x += m.vx / 60;
        m.y += m.vy / 60;
        const tx = m.x - (m.vx / 60) * 8;
        const ty = m.y - (m.vy / 60) * 8;
        const trail = ctx.createLinearGradient(m.x, m.y, tx, ty);
        trail.addColorStop(0, `rgba(255, 255, 255, ${(0.9 * m.life).toFixed(3)})`);
        trail.addColorStop(1, "rgba(255, 255, 255, 0)");
        ctx.strokeStyle = trail;
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        ctx.moveTo(m.x, m.y);
        ctx.lineTo(tx, ty);
        ctx.stroke();
      }
    };

    let frame = 0;
    let last = performance.now();
    const tick = (now: number) => {
      if (now - last < MIN_FRAME_MS) {
        frame = requestAnimationFrame(tick);
        return;
      }
      last = now;
      draw((now / 1000) * TS);
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, []);

  return (
    <canvas
      ref={ref}
      aria-hidden
      className="pointer-events-none absolute inset-0 z-0 h-full w-full"
      style={{ borderRadius: radius }}
    />
  );
}

/** Ghibli Treehouse Habitat: warm morning sun & swaying canopy leaves */
function TreehouseScene({ radius }: { radius: number }) {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 z-0 overflow-hidden" style={{ borderRadius: radius }}>
      <div className="absolute inset-0 bg-gradient-to-b from-[#1c1917] via-[#292524] to-[#0c0a09]" />
      {/* Warm golden-hour sunrise orb with subtle accent warmth */}
      <div
        className="absolute -top-10 left-1/2 aspect-square w-48 -translate-x-1/2 rounded-full blur-2xl"
        style={{
          background: "radial-gradient(circle, var(--accent, rgba(245, 158, 11, 0.28)) 0%, rgba(249, 115, 22, 0.12) 48%, transparent 72%)",
        }}
      />
      {/* Distant canopy tree line */}
      <svg className="absolute bottom-0 left-0 w-full opacity-35" viewBox="0 0 400 60" preserveAspectRatio="none">
        <path d="M 0 60 L 0 35 Q 35 15 70 30 Q 110 10 150 25 Q 190 5 230 22 Q 280 8 320 28 Q 365 14 400 32 L 400 60 Z" fill="#0f172a" />
      </svg>
      {/* Fore canopy tree line */}
      <svg className="absolute bottom-0 left-0 w-full opacity-60" viewBox="0 0 400 45" preserveAspectRatio="none">
        <path d="M 0 45 L 0 25 Q 45 8 90 20 Q 140 4 190 18 Q 250 2 300 16 Q 355 6 400 22 L 400 45 Z" fill="#05080f" />
      </svg>
      {/* Left hanging vine */}
      <svg className="absolute -top-1 left-2 h-24 w-16 opacity-75" viewBox="0 0 60 90">
        <path d="M 20 0 Q 30 45 15 90" fill="none" stroke="#22c55e" strokeWidth="2" opacity="0.6" />
        <ellipse cx="26" cy="24" rx="7" ry="4" transform="rotate(-20 26 24)" fill="#16a34a" />
        <ellipse cx="18" cy="46" rx="8" ry="4.5" transform="rotate(25 18 46)" fill="#22c55e" />
        <ellipse cx="24" cy="68" rx="6.5" ry="3.5" transform="rotate(-15 24 68)" fill="#15803d" />
      </svg>
      {/* Right hanging vine */}
      <svg className="absolute -top-1 right-3 h-28 w-16 opacity-75" viewBox="0 0 60 100">
        <path d="M 35 0 Q 20 50 40 100" fill="none" stroke="#22c55e" strokeWidth="2" opacity="0.6" />
        <ellipse cx="28" cy="30" rx="7.5" ry="4" transform="rotate(-30 28 30)" fill="#22c55e" />
        <ellipse cx="38" cy="56" rx="8" ry="4.5" transform="rotate(20 38 56)" fill="#16a34a" />
        <ellipse cx="30" cy="80" rx="7" ry="3.8" transform="rotate(-20 30 80)" fill="#15803d" />
      </svg>
    </div>
  );
}

/** Circuits Habitat: PCB copper circuit traces & CRT scanlines utilizing accent color */
function CircuitsScene({ radius }: { radius: number }) {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 z-0 overflow-hidden" style={{ borderRadius: radius }}>
      <div className="absolute inset-0 bg-gradient-to-b from-[#0e2723] via-[#091c19] to-[#05110f]" />
      {/* PCB copper circuit traces dynamically lit by accent color */}
      <svg className="absolute inset-0 size-full opacity-55" viewBox="0 0 400 200" preserveAspectRatio="none">
        <path d="M 20 20 L 80 20 L 110 50 L 220 50 L 240 70 L 380 70" fill="none" stroke="var(--accent, #2dd4bf)" strokeWidth="1.5" />
        <circle cx="20" cy="20" r="3.2" fill="var(--accent, #2dd4bf)" />
        <circle cx="380" cy="70" r="3.2" fill="var(--accent, #2dd4bf)" />
        <path d="M 40 160 L 140 160 L 170 130 L 280 130 L 300 110 L 360 110" fill="none" stroke="var(--accent, #2dd4bf)" strokeWidth="1.5" opacity="0.75" />
        <circle cx="40" cy="160" r="3.2" fill="var(--accent, #2dd4bf)" />
        <circle cx="360" cy="110" r="3.2" fill="var(--accent, #2dd4bf)" />
        <path d="M 160 30 L 190 30 L 210 50 L 210 90" fill="none" stroke="var(--accent, #2dd4bf)" strokeWidth="1.2" opacity="0.4" />
        <circle cx="210" cy="90" r="2.5" fill="var(--accent, #2dd4bf)" />
      </svg>
      {/* Retro Power LED indicator in top-right corner with accent glow */}
      <div className="absolute top-2.5 right-3 flex items-center gap-1.5">
        <span
          className="size-1.5 animate-pulse rounded-full"
          style={{ backgroundColor: "var(--accent, #34d399)", boxShadow: "0 0 8px var(--accent, rgba(52,211,153,0.9))" }}
        />
        <span className="font-mono text-[8px] font-semibold tracking-widest text-emerald-500/70">PWR</span>
      </div>
      {/* CRT phosphor scanline texture */}
      <div
        className="absolute inset-0 opacity-25"
        style={{
          background: "repeating-linear-gradient(0deg, rgba(0,0,0,0.4) 0px, rgba(0,0,0,0.4) 1px, transparent 1px, transparent 3px)",
        }}
      />
    </div>
  );
}

/** 8-Bit Pixel Sunset Skyline */
function PixelSkylineScene({ radius }: { radius: number }) {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 z-0 overflow-hidden" style={{ borderRadius: radius }}>
      <div className="absolute inset-0 bg-gradient-to-b from-[#180828] via-[#381446] to-[#0c0316]" />
      {/* Pixel Moon */}
      <div className="absolute top-3 right-8 size-7 rounded-sm bg-amber-200/90 shadow-[0_0_12px_rgba(253,230,138,0.5)]">
        <div className="absolute top-1 left-1 size-1.5 bg-amber-300/60" />
        <div className="absolute bottom-1.5 right-1.5 size-2 bg-amber-300/60" />
      </div>
      {/* Pixel Skyscraper Silhouettes */}
      <svg className="absolute bottom-0 left-0 w-full" viewBox="0 0 320 80" preserveAspectRatio="none">
        {/* Far layer */}
        <path d="M 0 80 L 0 45 L 25 45 L 25 35 L 50 35 L 50 80 L 85 80 L 85 28 L 115 28 L 115 80 L 155 80 L 155 40 L 180 40 L 180 80 L 220 80 L 220 30 L 250 30 L 250 80 L 285 80 L 285 45 L 320 45 L 320 80 Z" fill="#1f0f35" />
        {/* Near layer */}
        <path d="M 15 80 L 15 50 L 40 50 L 40 80 L 70 80 L 70 40 L 100 40 L 100 80 L 135 80 L 135 55 L 165 55 L 165 80 L 195 80 L 195 48 L 235 48 L 235 80 L 270 80 L 270 38 L 305 38 L 305 80 Z" fill="#0d0417" />
        {/* Lit pixel windows utilizing accent color */}
        <rect x="75" y="44" width="3" height="3" fill="var(--accent, #67e8f9)" opacity="0.9" />
        <rect x="85" y="44" width="3" height="3" fill="#fef08a" opacity="0.8" />
        <rect x="75" y="52" width="3" height="3" fill="var(--accent, #67e8f9)" opacity="0.9" />
        <rect x="140" y="60" width="3" height="3" fill="#fef08a" opacity="0.8" />
        <rect x="150" y="68" width="3" height="3" fill="var(--accent, #67e8f9)" opacity="0.8" />
        <rect x="205" y="54" width="3" height="3" fill="#f472b6" opacity="0.8" />
        <rect x="218" y="62" width="3" height="3" fill="#fef08a" opacity="0.8" />
        <rect x="280" y="44" width="3" height="3" fill="var(--accent, #67e8f9)" opacity="0.9" />
        <rect x="292" y="52" width="3" height="3" fill="#fef08a" opacity="0.8" />
        {/* Radio antenna beacon */}
        <line x1="85" y1="28" x2="85" y2="18" stroke="var(--accent, #ef4444)" strokeWidth="1.5" />
        <circle cx="85" cy="17" r="1.5" fill="var(--accent, #ef4444)" className="animate-ping" />
      </svg>
    </div>
  );
}

/** Custom Image Wallpaper Scene with adjustable blur and contrast dimming */
function CustomWallpaperScene({ radius }: { radius: number }) {
  const custom = settings.use().appearance.customWallpaper;
  const dataUrl = custom?.dataUrl;
  const dimming = (custom?.dimming ?? 40) / 100;
  const blur = custom?.blur ?? 0;
  const fit = custom?.fit ?? "cover";

  if (!dataUrl) {
    return <div className="absolute inset-0 bg-black" style={{ borderRadius: radius }} />;
  }

  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 z-0 overflow-hidden" style={{ borderRadius: radius }}>
      <img
        src={dataUrl}
        alt=""
        className={`size-full ${fit === "contain" ? "object-contain" : "object-cover"}`}
        style={{ filter: blur > 0 ? `blur(${blur}px)` : undefined, transform: blur > 0 ? "scale(1.08)" : undefined }}
      />
      {/* Dimming overlay so text and controls always stay high-contrast */}
      <div className="absolute inset-0" style={{ backgroundColor: `rgba(0, 0, 0, ${dimming})` }} />
    </div>
  );
}
