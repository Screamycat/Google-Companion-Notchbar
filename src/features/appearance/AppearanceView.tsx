import { useEffect, useState, useRef } from "react";
import { CellSignalHigh, Check, ImageSquare, MusicNoteSimple, Sparkle, UploadSimple, X } from "@phosphor-icons/react";
import { useNowPlaying } from "../../platform/media";
import { settings, updateSettings, type AppearanceEffect, type Settings } from "../../settings/store";
import { Group, Row, Segmented, Slider, Switch, Button } from "../../ui/controls";
import { Equalizer } from "../now-playing/Equalizer";
import { BackgroundEffects } from "../../notch/BackgroundEffects";
import { locale, t } from "../../i18n";
import { DynamicWorldStudio } from "./DynamicWorldStudio";

/*
 * Appearance tab: live preview of the notch, categorized background effects,
 * custom wallpaper upload, colors, shape and material.
 */

const EFFECT_ORDER: AppearanceEffect[] = [
  "none",
  "dynamic-world",
  "visualizer",
  "matrix-rain",
  "warp-starfield",
  "waves",
  "pixel-skyline",
  "rainy-window",
  "cozy-fireplace",
  "treehouse",
  "circuits",
  "aurora",
  "ambient",
  "celestial-nebula",
  "chromatic-prism",
  "synthwave",
  "nightsky",
  "holographic",
  "topographic",
  "custom-image",
];

const EFFECT_MUSIC: Record<AppearanceEffect, boolean> = {
  none: false,
  "dynamic-world": false,
  visualizer: true,
  "matrix-rain": true,
  "warp-starfield": true,
  waves: true,
  "pixel-skyline": true,
  "rainy-window": false,
  "cozy-fireplace": false,
  treehouse: false,
  circuits: false,
  "bmo-retro": false,
  aurora: false,
  ambient: false,
  "celestial-nebula": false,
  "chromatic-prism": false,
  synthwave: false,
  nightsky: false,
  holographic: false,
  topographic: false,
  "custom-image": false,
};

type EffectCategory = "all" | "music" | "moving" | "static";

const CATEGORY_MAP: Record<EffectCategory, AppearanceEffect[]> = {
  all: EFFECT_ORDER,
  music: ["visualizer", "matrix-rain", "warp-starfield", "waves", "pixel-skyline"],
  moving: [
    "dynamic-world",
    "rainy-window",
    "cozy-fireplace",
    "treehouse",
    "circuits",
    "aurora",
    "ambient",
    "celestial-nebula",
    "chromatic-prism",
    "topographic",
    "holographic",
  ],
  static: ["custom-image", "synthwave", "nightsky", "none"],
};

const ACCENTS = ["#0a84ff", "#5ac8fa", "#30d158", "#ffd60a", "#ff9f0a", "#ff453a", "#bf5af2", "#ffffff"];
const DARK_SHADES = ["#000000", "#101014", "#0d1b2a", "#1a1a1e", "#12233f", "#1f1b3d", "#0f2e1f", "#2a1a3d", "#ffffff"];

export function AppearanceView() {
  const a = settings.use().appearance;
  const setAp = (patch: Partial<Settings["appearance"]>) => updateSettings((s) => ({ appearance: { ...s.appearance, ...patch } }));
  const [category, setCategory] = useState<EffectCategory>("all");
  const filteredEffects = CATEGORY_MAP[category] ?? EFFECT_ORDER;
  const fileInputRef = useRef<HTMLInputElement>(null);

  const onUploadFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        setAp({
          effect: "custom-image",
          customWallpaper: {
            dataUrl: reader.result,
            dimming: a.customWallpaper?.dimming ?? 40,
            blur: a.customWallpaper?.blur ?? 0,
            fit: a.customWallpaper?.fit ?? "cover",
          },
        });
      }
    };
    reader.readAsDataURL(file);
  };

  return (
    <div
      className="h-full overflow-y-auto px-5 pt-1 pb-6 [scrollbar-width:none]"
      style={{ maskImage: "linear-gradient(180deg, #000 calc(100% - 28px), transparent)" }}
    >
      <div className="flex flex-col gap-4">
        <Preview />
        <section>
          <div className="mb-2 flex items-baseline justify-between gap-2 px-1">
            <h3 className="text-caption font-medium tracking-wide text-label-3 uppercase">{t("Hintergrundeffekt")}</h3>
            <span className="flex items-center gap-1 text-caption text-label-3">
              <MusicNoteSimple size={10} weight="fill" />
              {t("Effekte bewegen sich zu deiner Musik")}
            </span>
          </div>
          <div className="mb-3">
            <Segmented
              id="appearance-effect-cat"
              size="sm"
              value={category}
              onChange={setCategory}
              options={[
                { value: "all", label: t("Alle") },
                { value: "music", label: t("Musik") },
                { value: "moving", label: t("Bewegt") },
                { value: "static", label: t("Statisch") },
              ]}
            />
          </div>
          <div className="grid grid-cols-3 gap-x-2.5 gap-y-3">
            {filteredEffects.map((id) => (
              <EffectCard key={id} id={id} selected={a.effect === id} onPick={() => setAp({ effect: id })} />
            ))}
          </div>
        </section>

        {a.effect === "dynamic-world" && <DynamicWorldStudio />}

        {a.effect === "custom-image" && (
          <Group title={t("Eigenes Hintergrundbild")}>
            <Row label={t("Bilddatei")} hint={t("Wähle ein PNG, JPG, WEBP oder animiertes GIF.")}>
              <div className="flex items-center gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/gif"
                  className="hidden"
                  onChange={onUploadFile}
                />
                <Button
                  onClick={() => fileInputRef.current?.click()}
                  icon={UploadSimple}
                >
                  {a.customWallpaper?.dataUrl ? t("Bild ändern") : t("Bild hochladen")}
                </Button>
                {a.customWallpaper?.dataUrl && (
                  <Button
                    onClick={() =>
                      setAp({
                        customWallpaper: undefined,
                        effect: "none",
                      })
                    }
                    icon={X}
                  >
                    {t("Entfernen")}
                  </Button>
                )}
              </div>
            </Row>
            {a.customWallpaper?.dataUrl && (
              <>
                <Row label={t("Einpassung")}>
                  <Segmented
                    id="custom-fit"
                    size="sm"
                    value={a.customWallpaper.fit ?? "cover"}
                    onChange={(fit) =>
                      setAp({
                        customWallpaper: {
                          ...a.customWallpaper!,
                          fit: fit as "cover" | "contain",
                        },
                      })
                    }
                    options={[
                      { value: "cover", label: t("Ausfüllen") },
                      { value: "contain", label: t("Einpassen") },
                    ]}
                  />
                </Row>
                <Row label={t("Abdunkelung")} hint={t("Hält Text und Symbole gut lesbar.")}>
                  <div className="flex w-36 items-center gap-2">
                    <Slider
                      label={t("Abdunkelung")}
                      value={a.customWallpaper.dimming ?? 40}
                      min={0}
                      max={85}
                      step={5}
                      onChange={(dimming) =>
                        setAp({
                          customWallpaper: {
                            ...a.customWallpaper!,
                            dimming,
                          },
                        })
                      }
                    />
                    <span className="w-8 text-right text-caption text-label-2 tabular">
                      {a.customWallpaper.dimming ?? 40}%
                    </span>
                  </div>
                </Row>
                <Row label={t("Weichzeichner")}>
                  <div className="flex w-36 items-center gap-2">
                    <Slider
                      label={t("Weichzeichner")}
                      value={a.customWallpaper.blur ?? 0}
                      min={0}
                      max={24}
                      step={2}
                      onChange={(blur) =>
                        setAp({
                          customWallpaper: {
                            ...a.customWallpaper!,
                            blur,
                          },
                        })
                      }
                    />
                    <span className="w-8 text-right text-caption text-label-2 tabular">
                      {a.customWallpaper.blur ?? 0}px
                    </span>
                  </div>
                </Row>
              </>
            )}
          </Group>
        )}
        <Group title={t("Farbe")}>
          <Row label={t("Akzent")} hint={t("Schalter, Highlights und Effekte.")}>
            <div className="flex max-w-[290px] flex-wrap items-center justify-end gap-1.5">
              {ACCENTS.map((c) => (
                <Dot key={c} color={c} label={c} selected={a.accent === c} onPick={() => setAp({ accent: c })} />
              ))}
              <button
                aria-pressed={a.accent === "cycle"}
                onClick={() => setAp({ accent: "cycle" })}
                className="h-6 rounded-full bg-fill-2 px-2.5 text-caption text-label-2"
                style={a.accent === "cycle" ? { outline: "2px solid #fff", outlineOffset: 1, color: "#fff" } : undefined}
              >
                {t("Wechsel")}
              </button>
              <CustomDot
                value={ACCENTS.includes(a.accent) || a.accent === "cycle" ? "#ff453a" : a.accent}
                selected={!ACCENTS.includes(a.accent) && a.accent !== "cycle"}
                onPick={(c) => setAp({ accent: c })}
              />
            </div>
          </Row>
          <Row label={t("Ruhende Notch")} hint={t("Farbe der geschlossenen Notch.")}>
            <div className="flex max-w-[290px] flex-wrap items-center justify-end gap-1.5">
              {DARK_SHADES.map((c) => (
                <Dot key={c} color={c} label={c} selected={a.resting === c} onPick={() => setAp({ resting: c })} />
              ))}
              <CustomDot value={a.resting} selected={!DARK_SHADES.includes(a.resting)} onPick={(c) => setAp({ resting: c })} />
            </div>
          </Row>
          <Row label={t("Geöffnete Notch")} hint={t("Gilt, wenn das Material auf Massiv steht.")}>
            <div className="flex max-w-[290px] flex-wrap items-center justify-end gap-1.5">
              {DARK_SHADES.map((c) => (
                <Dot key={c} color={c} label={c} selected={a.expanded === c} onPick={() => setAp({ expanded: c })} />
              ))}
              <CustomDot value={a.expanded} selected={!DARK_SHADES.includes(a.expanded)} onPick={(c) => setAp({ expanded: c })} />
            </div>
          </Row>
        </Group>
        <Group title={t("Form & Material")}>
          <Row label={t("Ecken")}>
            <Segmented
              id="appearance-corners"
              size="sm"
              value={a.corners}
              onChange={(corners) => setAp({ corners })}
              options={[
                { value: "rounded", label: t("Abgerundet") },
                { value: "squared", label: t("Eckig") },
              ]}
            />
          </Row>
          <Row label={t("Material")} hint={t("Glas ist leichter und durchsichtig; Massiv nutzt die Farbe der geöffneten Notch.")}>
            <Segmented
              id="appearance-material"
              size="sm"
              value={a.material}
              onChange={(material) => setAp({ material })}
              options={[
                { value: "glass", label: t("Glas") },
                { value: "dark", label: t("Dunkles Glas") },
                { value: "solid", label: t("Massiv") },
              ]}
            />
          </Row>
          <Row label={t("Karten")} hint={t("Dunklere Karten halten Text über Effekten lesbar.")}>
            <Segmented
              id="appearance-cards"
              size="sm"
              value={a.cards}
              onChange={(cards) => setAp({ cards })}
              options={[
                { value: "light", label: t("Hell") },
                { value: "dark", label: t("Dunkel") },
                { value: "darker", label: t("Dunkler") },
              ]}
            />
          </Row>
          <Row label={t("Kantenleuchten")} hint={t("Ein weicher Hof in Akzentfarbe um die Notch.")}>
            <Segmented
              id="appearance-glow"
              size="sm"
              value={a.glow}
              onChange={(glow) => setAp({ glow })}
              options={[
                { value: "off", label: t("Aus") },
                { value: "subtle", label: t("Dezent") },
                { value: "strong", label: t("Stark") },
              ]}
            />
          </Row>
        </Group>
        <Group title={t("Symbole & Untertexte")}>
          <Row label={t("Symbole in der Leiste")} hint={t("Helligkeit der inaktiven Werkzeug-Symbole.")}>
            <div className="flex w-44 items-center gap-2">
              <Slider label={t("Symbole in der Leiste")} value={a.icons} min={1} max={6} step={0.05} onChange={(icons) => setAp({ icons })} />
              <span className="tabular w-10 shrink-0 text-right text-caption text-label-2">{Math.round(a.icons * 100)} %</span>
            </div>
          </Row>
          <Row label={t("Untertexte")} hint={t("Helligkeit von blassem Text wie „Aus“ oder „3 Geräte“.")}>
            <div className="flex w-44 items-center gap-2">
              <Slider label={t("Untertexte")} value={a.subtext} min={1} max={2} step={0.05} onChange={(subtext) => setAp({ subtext })} />
              <span className="tabular w-10 shrink-0 text-right text-caption text-label-2">{Math.round(a.subtext * 100)} %</span>
            </div>
          </Row>
        </Group>
        <Group title={t("Geschlossene Notch")}>
          <Row label={t("Hintergrundeffekt")} hint={t("Zeigt den Effekt auch in der geschlossenen Notch. Nicht mit der Linie.")}>
            <Switch label={t("Hintergrundeffekt")} checked={a.closedEffect} onChange={(closedEffect) => setAp({ closedEffect })} />
          </Row>
        </Group>
      </div>
    </div>
  );
}

/** Live miniature: the resting colour, the real clock, the real equalizer — and the picked effect behind the card. */
function Preview() {
  const a = settings.use().appearance;
  const np = useNowPlaying();
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 20_000);
    return () => window.clearInterval(id);
  }, []);
  const day = new Intl.DateTimeFormat(locale(), { weekday: "short" }).format(now);
  const time = new Intl.DateTimeFormat(locale(), { hour: "2-digit", minute: "2-digit" }).format(now);
  return (
    <div
      aria-hidden
      className="flex flex-col items-center gap-3 rounded-[16px] px-6 py-5"
      style={{ background: "linear-gradient(135deg, #3d4c6d 0%, #5b5a7e 55%, #7a7264 100%)" }}
    >
      <div className="flex h-[26px] items-center gap-1.5 px-3.5" style={{ background: a.resting, borderRadius: a.corners === "squared" ? 8 : 999 }}>
        <span className="text-caption text-label-2">{day}</span>
        <span className="tabular text-caption font-semibold text-label">{time}</span>
        <CellSignalHigh size={12} weight="fill" className="text-label-2" />
        <Equalizer playing={np?.isPlaying ?? false} height={9} />
      </div>
      <div className="relative w-[290px] overflow-hidden rounded-[18px] bg-black" style={{ background: a.expanded }}>
        <BackgroundEffects effect={a.effect} playing={np?.isPlaying ?? false} radius={18} />
        <div className="relative z-10 flex items-center gap-3 p-3">
        <div
          className="flex h-16 w-20 shrink-0 items-end justify-center gap-[3px] overflow-hidden rounded-[12px] pb-2"
          style={{ background: "linear-gradient(180deg, #2b1a4d 0%, #0d0d18 70%)" }}
        >
          {[10, 18, 26, 20, 32, 24, 30].map((h, i) => (
            <div key={i} className="w-[5px] rounded-full" style={{ height: h, background: "linear-gradient(180deg, #e07bff, #5ac8fa)" }} />
          ))}
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <div className="h-1.5 rounded-full bg-fill-3" style={{ width: "82%" }} />
          <div className="h-1.5 rounded-full bg-fill-3" style={{ width: "64%" }} />
          <div className="relative h-1 rounded-full bg-fill-3">
            <div className="absolute inset-y-0 left-0 w-[60%] rounded-full bg-label" />
          </div>
        </div>
      </div>
      </div>
    </div>
  );
}

function effectText(id: AppearanceEffect): { name: string; desc: string } {
  switch (id) {
    case "none":
      return { name: t("Ohne"), desc: t("Sauberes Schwarz") };
    case "dynamic-world":
      return { name: t("Dynamische Welt"), desc: t("Echtzeit-Wetter & Tag/Nacht-Studio") };
    case "rainy-window":
      return { name: t("Regenfenster"), desc: t("Atmosphärische Wassertropfen") };
    case "cozy-fireplace":
      return { name: t("Kaminfeuer"), desc: t("Warme Glut & Funken") };
    case "treehouse":
      return { name: t("Baumhaus"), desc: t("Ghibli-Dämmerung & Blätter") };
    case "circuits":
    case "bmo-retro":
      return { name: t("Schaltkreise"), desc: t("Vintage-Platine & Scanlines") };
    case "matrix-rain":
      return { name: t("Matrix Rain"), desc: t("Grüner Digitalcode im Takt") };
    case "warp-starfield":
      return { name: t("Warp-Antrieb"), desc: t("Hyperspace-Sternenflug") };
    case "pixel-skyline":
      return { name: t("Pixel Skyline"), desc: t("8-Bit Stadt bei Nacht") };
    case "chromatic-prism":
      return { name: t("Prisma-Brechung"), desc: t("Sanfte Regenbogen-Strahlen") };
    case "celestial-nebula":
      return { name: t("Sternennebel"), desc: t("Kosmische Staubwolken") };
    case "visualizer":
      return { name: t("Visualisierer"), desc: t("Balken in Albumfarben") };
    case "ambient":
      return { name: t("Umgebung"), desc: t("Albumfarben, pulsierend") };
    case "waves":
      return { name: t("Wellen"), desc: t("Gezeiten in Albumfarben") };
    case "aurora":
      return { name: t("Aurora"), desc: t("Nordlichter in Albumfarben") };
    case "synthwave":
      return { name: t("Synthwave"), desc: t("Retro-Sonne und Neon-Raster") };
    case "nightsky":
      return { name: t("Nachthimmel"), desc: t("Sterne und Meteore") };
    case "holographic":
      return { name: t("Holografisch"), desc: t("Schillernder Folien-Glanz") };
    case "topographic":
      return { name: t("Topografisch"), desc: t("Langsame Höhenlinien") };
    case "custom-image":
      return { name: t("Eigenes Bild"), desc: t("Benutzerdefiniertes Wallpaper") };
  }
}

function EffectCard({ id, selected, onPick }: { id: AppearanceEffect; selected: boolean; onPick: () => void }) {
  const { name, desc } = effectText(id);
  return (
    <button aria-pressed={selected} onClick={onPick} className="group text-left">
      <span className="relative block">
        <span
          className="block aspect-[16/10] overflow-hidden rounded-[12px]"
          style={selected ? { outline: "2px solid #2f7bff", outlineOffset: 1 } : undefined}
        >
          <EffectThumb id={id} />
        </span>
        {EFFECT_MUSIC[id] && (
          <span className="absolute bottom-1 left-1 flex items-center gap-0.5 rounded-full bg-black/65 px-1.5 py-0.5 text-caption text-label">
            <MusicNoteSimple size={10} weight="fill" />
            {t("Musik")}
          </span>
        )}
        {id === "dynamic-world" && (
          <span className="absolute bottom-1 left-1 flex items-center gap-1 rounded-full bg-indigo-500/85 px-2 py-0.5 text-[10px] font-semibold text-white shadow-[0_0_8px_rgba(99,102,241,0.6)] backdrop-blur-sm">
            <Sparkle size={10} weight="fill" className="text-amber-300" />
            {t("Studio")}
          </span>
        )}
        {selected && (
          <span className="absolute -top-1.5 -right-1.5 flex size-5 items-center justify-center rounded-full bg-[#2f7bff]">
            <Check size={12} weight="bold" className="text-white" />
          </span>
        )}
      </span>
      <span className="mt-1.5 block text-footnote font-medium text-label">{name}</span>
      <span className="block text-caption text-label-3">{desc}</span>
    </button>
  );
}

/** Static miniature of each effect (the live versions render in the notch). */
function EffectThumb({ id }: { id: AppearanceEffect }) {
  const custom = settings.use().appearance.customWallpaper;
  if (id === "none") return <span className="block h-full w-full bg-black" />;
  if (id === "custom-image") {
    if (custom?.dataUrl) {
      return (
        <span className="relative block h-full w-full overflow-hidden bg-black">
          <img src={custom.dataUrl} alt="" className="size-full object-cover" />
          <span className="absolute inset-0 bg-black/30" />
        </span>
      );
    }
    return (
      <span className="flex h-full w-full flex-col items-center justify-center gap-1 border border-dashed border-white/20 bg-fill-1 text-label-3">
        <ImageSquare size={20} weight="duotone" />
        <span className="text-[10px]">{t("Bild wählen")}</span>
      </span>
    );
  }
  if (id === "dynamic-world")
    return (
      <span className="relative block h-full w-full overflow-hidden bg-gradient-to-b from-[#1e40af] via-[#38bdf8] to-[#93c5fd]">
        <span className="absolute top-1.5 right-2 size-2.5 rounded-full bg-amber-300 shadow-[0_0_6px_rgba(252,211,77,0.9)]" />
        <svg viewBox="0 0 100 40" preserveAspectRatio="none" className="absolute bottom-0 w-full h-5 opacity-70">
          <path d="M 0 40 L 0 25 L 25 15 L 50 25 L 75 10 L 100 20 L 100 40 Z" fill="#1e293b" />
        </svg>
        <span className="absolute top-2 left-3 size-1 rounded-full bg-white/70" />
        <span className="absolute top-3 left-7 h-2 w-0.5 -rotate-12 bg-sky-100/70" />
      </span>
    );
  if (id === "rainy-window")
    return (
      <span className="relative block h-full w-full overflow-hidden bg-gradient-to-b from-[#080c16] to-[#121a2d]">
        <span className="absolute inset-0 opacity-40" style={{ background: "radial-gradient(circle at 50% 120%, rgba(56, 189, 248, 0.35), transparent 70%)" }} />
        {[
          [15, 20, 16],
          [35, 10, 24],
          [55, 30, 18],
          [75, 15, 22],
          [90, 40, 14],
          [25, 55, 20],
          [68, 60, 16],
        ].map(([x, y, l], i) => (
          <span
            key={i}
            className="absolute w-[1.5px] rounded-full bg-sky-200/60"
            style={{ left: `${x}%`, top: `${y}%`, height: l }}
          />
        ))}
      </span>
    );
  if (id === "cozy-fireplace")
    return (
      <span className="relative block h-full w-full overflow-hidden bg-[#070403]">
        <span className="absolute -bottom-6 left-1/2 h-16 w-32 -translate-x-1/2 rounded-full bg-gradient-to-t from-orange-600/80 via-amber-500/50 to-transparent blur-md" />
        {[
          [30, 60, 2],
          [45, 45, 1.5],
          [55, 55, 2],
          [65, 40, 1.5],
          [50, 25, 1.2],
        ].map(([x, y, s], i) => (
          <span
            key={i}
            className="absolute rounded-full bg-amber-300 shadow-[0_0_4px_rgba(251,191,36,0.9)]"
            style={{ left: `${x}%`, top: `${y}%`, width: s * 1.5, height: s * 1.5 }}
          />
        ))}
      </span>
    );
  if (id === "treehouse")
    return (
      <span className="relative block h-full w-full overflow-hidden bg-gradient-to-b from-[#1c1917] via-[#292524] to-[#0c0a09]">
        <span className="absolute -top-4 left-1/2 size-16 -translate-x-1/2 rounded-full bg-amber-500/30 blur-md" />
        <span className="absolute bottom-0 inset-x-0 h-6 bg-[#05080f] opacity-80" />
        <span className="absolute top-0 left-2 w-4 h-8 bg-emerald-500/60 rounded-b-full blur-[0.5px]" />
        <span className="absolute top-0 right-3 w-4 h-9 bg-green-500/60 rounded-b-full blur-[0.5px]" />
      </span>
    );
  if (id === "circuits" || id === "bmo-retro")
    return (
      <span className="relative block h-full w-full overflow-hidden bg-gradient-to-b from-[#0e2723] via-[#091c19] to-[#05110f]">
        <span
          className="absolute top-2 right-2 size-1.5 rounded-full"
          style={{ backgroundColor: "var(--accent, #34d399)", boxShadow: "0 0 6px var(--accent, rgba(52,211,153,0.9))" }}
        />
        <svg viewBox="0 0 100 60" className="absolute inset-0 size-full opacity-60">
          <path d="M 10 10 L 40 10 L 60 30 L 90 30" fill="none" stroke="var(--accent, #2dd4bf)" strokeWidth="1.5" />
          <circle cx="10" cy="10" r="2.5" fill="var(--accent, #2dd4bf)" />
          <circle cx="90" cy="30" r="2.5" fill="var(--accent, #2dd4bf)" />
        </svg>
        <span className="absolute inset-0 opacity-25" style={{ background: "repeating-linear-gradient(0deg, rgba(0,0,0,0.5) 0 1px, transparent 1px 3px)" }} />
      </span>
    );
  if (id === "matrix-rain")
    return (
      <span className="relative block h-full w-full overflow-hidden bg-[#040906] font-mono text-[6px] text-emerald-400">
        {[
          [10, 0],
          [24, -10],
          [40, 15],
          [56, -5],
          [72, 8],
          [88, -12],
        ].map(([x, y], i) => (
          <span key={i} className="absolute flex flex-col leading-none" style={{ left: `${x}%`, top: `${y}px` }}>
            <span className="text-white">1</span>
            <span className="text-emerald-300">0</span>
            <span className="text-emerald-500">1</span>
            <span className="text-emerald-700">0</span>
          </span>
        ))}
      </span>
    );
  if (id === "warp-starfield")
    return (
      <span className="relative block h-full w-full overflow-hidden bg-[#030308]">
        {[
          [20, 20, 60, 40],
          [80, 25, 55, 45],
          [15, 75, 45, 55],
          [85, 80, 52, 52],
          [50, 10, 50, 35],
          [50, 90, 50, 65],
        ].map(([x2, y2, x1, y1], i) => (
          <svg key={i} className="absolute inset-0 size-full">
            <line x1={`${x1}%`} y1={`${y1}%`} x2={`${x2}%`} y2={`${y2}%`} stroke="rgba(255,255,255,0.8)" strokeWidth="1.2" strokeLinecap="round" />
          </svg>
        ))}
      </span>
    );
  if (id === "pixel-skyline")
    return (
      <span className="relative block h-full w-full overflow-hidden bg-gradient-to-b from-[#180828] via-[#381446] to-[#0c0316]">
        <span className="absolute top-2 right-4 size-3 bg-amber-200/90 shadow-[0_0_6px_rgba(253,230,138,0.6)]" />
        <svg viewBox="0 0 100 40" preserveAspectRatio="none" className="absolute bottom-0 w-full h-8">
          <path d="M 0 40 L 0 20 L 15 20 L 15 12 L 35 12 L 35 40 L 55 40 L 55 18 L 75 18 L 75 40 L 90 40 L 90 22 L 100 22 L 100 40 Z" fill="#0d0417" />
          <rect x="20" y="16" width="3" height="3" fill="#fef08a" />
          <rect x="62" y="24" width="3" height="3" fill="#67e8f9" />
        </svg>
      </span>
    );
  if (id === "chromatic-prism")
    return (
      <span className="relative block h-full w-full overflow-hidden bg-[#07080e]">
        <span
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(135deg, transparent 15%, rgba(255,80,120,0.3) 35%, rgba(255,210,80,0.3) 50%, rgba(80,230,255,0.3) 65%, transparent 85%)",
          }}
        />
        <span className="absolute top-0 bottom-0 left-[45%] w-8 -rotate-45 bg-white/20 blur-[6px]" />
      </span>
    );
  if (id === "celestial-nebula")
    return (
      <span className="relative block h-full w-full overflow-hidden bg-[#04030a]">
        <span className="absolute top-[-10%] left-[10%] size-16 rounded-full bg-violet-600/40 blur-md" />
        <span className="absolute bottom-[-10%] right-[10%] size-14 rounded-full bg-pink-600/35 blur-md" />
        <span className="absolute top-[30%] left-[45%] size-10 rounded-full bg-cyan-500/30 blur-md" />
      </span>
    );
  if (id === "visualizer")
    return (
      <span className="relative flex h-full w-full items-end justify-center gap-[3px] overflow-hidden bg-black px-3 pt-2 pb-1.5">
        <span className="absolute inset-x-8 top-1 h-8 rounded-full bg-indigo-500/25 blur-md" />
        {[38, 55, 70, 48, 82, 64, 90, 58, 74, 44, 66, 52, 78, 60].map((h, i) => (
          <span
            key={i}
            className="relative w-full rounded-full"
            style={{ height: `${h}%`, background: "linear-gradient(180deg, #8ff5ff, #5ac8fa 55%, #7b3fe4)", boxShadow: "0 0 6px rgb(90 200 250 / 0.55)" }}
          />
        ))}
      </span>
    );
  if (id === "ambient")
    return (
      <span className="relative block h-full w-full overflow-hidden" style={{ background: "linear-gradient(180deg, #0b1040 0%, #060818 100%)" }}>
        <span className="absolute top-[-25%] left-[2%] h-[95%] w-[60%] rounded-full bg-indigo-500/70 blur-md" />
        <span className="absolute top-[5%] right-[-5%] h-[85%] w-[55%] rounded-full bg-fuchsia-500/60 blur-md" />
        <span className="absolute bottom-[-35%] left-[28%] h-[75%] w-[62%] rounded-full bg-cyan-400/55 blur-md" />
        <span className="absolute top-[30%] left-[42%] h-[45%] w-[30%] rounded-full bg-violet-300/40 blur-md" />
      </span>
    );
  if (id === "waves")
    return (
      <span className="block h-full w-full bg-[#06121f]">
        <svg viewBox="0 0 160 100" preserveAspectRatio="none" className="h-full w-full">
          <path d="M0 62 Q 20 48, 40 60 T 80 58 T 120 62 T 160 56 L160 100 L0 100 Z" fill="rgb(52 211 153 / 0.35)" />
          <path d="M0 72 Q 20 60, 40 70 T 80 68 T 120 72 T 160 66 L160 100 L0 100 Z" fill="rgb(34 211 238 / 0.45)" />
          <path d="M0 62 Q 20 48, 40 60 T 80 58 T 120 62 T 160 56" fill="none" stroke="#5ce1e6" strokeWidth="2" />
        </svg>
      </span>
    );
  if (id === "aurora")
    return (
      <span className="relative block h-full w-full overflow-hidden bg-[#020a08]">
        <span className="absolute inset-x-0 top-0 h-[72%]" style={{ background: "linear-gradient(180deg, rgb(110 255 190 / 0.75) 0%, rgb(60 220 170 / 0.28) 55%, transparent 100%)" }} />
        <span className="absolute top-0 bottom-[30%] left-[30%] w-[16%] rotate-6 rounded-full bg-emerald-200/50 blur-[5px]" />
        <span className="absolute top-0 bottom-[35%] left-[58%] w-[12%] -rotate-6 rounded-full bg-teal-100/45 blur-[5px]" />
        {[[18, 72], [34, 80], [52, 70], [70, 78], [86, 68]].map(([x, y], i) => (
          <span key={i} className="absolute size-[2px] rounded-full bg-white/80" style={{ left: `${x}%`, top: `${y}%` }} />
        ))}
      </span>
    );
  if (id === "nightsky")
    return (
      <span className="relative block h-full w-full overflow-hidden bg-[#060a1c]">
        <span className="absolute top-[10%] left-[8%] h-[70%] w-[45%] rounded-full bg-violet-600/30 blur-md" />
        <span className="absolute top-[30%] right-[5%] h-[60%] w-[40%] rounded-full bg-blue-500/25 blur-md" />
        <span className="absolute top-[16%] right-[14%] size-3 rounded-full bg-[#f4f1de]" />
        <span className="absolute top-[30%] left-[52%] h-[2px] w-10 -rotate-[24deg] rounded-full" style={{ background: "linear-gradient(90deg, transparent, #fff)" }} />
        {[
          [12, 22],
          [26, 60],
          [40, 30],
          [55, 66],
          [68, 40],
          [84, 62],
          [92, 26],
          [33, 76],
        ].map(([x, y], i) => (
          <span key={i} className="absolute size-[2px] rounded-full bg-white/80" style={{ left: `${x}%`, top: `${y}%` }} />
        ))}
      </span>
    );
  if (id === "holographic")
    return (
      <span className="relative block h-full w-full overflow-hidden bg-[#0b0a16]">
        <span
          className="absolute inset-0"
          style={{ background: "linear-gradient(115deg, transparent 5%, rgb(224 123 255 / 0.35) 28%, rgb(92 225 230 / 0.35) 48%, rgb(255 214 10 / 0.28) 66%, transparent 90%)" }}
        />
        <span className="absolute top-[-20%] bottom-[-20%] left-[55%] w-[14%] rotate-[24deg] rounded-full bg-white/25 blur-[4px]" />
        <span className="absolute inset-0" style={{ background: "repeating-linear-gradient(115deg, transparent 0 9px, rgb(255 255 255 / 0.05) 9px 10px)" }} />
      </span>
    );
  if (id === "topographic")
    return (
      <span className="block h-full w-full bg-[#070604]">
        <svg viewBox="0 0 160 100" preserveAspectRatio="xMidYMid slice" className="h-full w-full">
          <g fill="none" stroke="#ff9f0a" strokeWidth="1">
            <ellipse cx="80" cy="58" rx="14" ry="10" opacity="0.9" />
            <ellipse cx="80" cy="58" rx="26" ry="18" opacity="0.75" />
            <ellipse cx="78" cy="56" rx="40" ry="27" opacity="0.6" />
            <ellipse cx="82" cy="60" rx="55" ry="37" opacity="0.45" />
            <ellipse cx="80" cy="58" rx="72" ry="48" opacity="0.3" />
            <ellipse cx="80" cy="58" rx="90" ry="60" opacity="0.2" />
          </g>
        </svg>
      </span>
    );
  return (
    <span className="relative block h-full w-full overflow-hidden" style={{ background: "linear-gradient(180deg, #150833 0%, #7a2a86 60%, #0d0518 61%, #0d0518 100%)" }}>
      <span
        className="absolute top-[14%] left-1/2 h-[42%] w-[30%] -translate-x-1/2 rounded-full"
        style={{ background: "linear-gradient(180deg, #ffd60a 0%, #ff453a 100%)" }}
      />
      <span
        className="absolute right-0 bottom-0 left-0 h-[39%]"
        style={{
          background:
            "repeating-linear-gradient(90deg, rgb(224 123 255 / 0.6) 0 1px, transparent 1px 12px), repeating-linear-gradient(0deg, rgb(224 123 255 / 0.6) 0 1px, transparent 1px 6px)",
        }}
      />
    </span>
  );
}

/** Colour dot with a contrast-aware check when selected. */
function Dot({ color, label, selected, onPick }: { color: string; label: string; selected: boolean; onPick: () => void }) {
  const dark = luminance(color) > 0.6;
  const ring = dark ? "#1a1a1a" : "#ffffff";
  return (
    <button
      aria-label={label}
      title={label}
      aria-pressed={selected}
      onClick={onPick}
      className="flex size-6 items-center justify-center rounded-full ring-1 ring-white/15"
      style={{ background: color, outline: selected ? `2px solid ${ring}` : "none", outlineOffset: 1 }}
    >
      {selected && <Check size={12} weight="bold" style={{ color: ring }} />}
    </button>
  );
}

/** Rainbow dot: opens the system colour picker for a custom colour. */
function CustomDot({ value, selected, onPick }: { value: string; selected: boolean; onPick: (c: string) => void }) {
  return (
    <label
      title={t("Benutzerdefiniert")}
      className="relative flex size-6 cursor-pointer items-center justify-center rounded-full ring-1 ring-white/15"
      style={{
        background: "conic-gradient(from 0deg, #ff453a, #ffd60a, #30d158, #5ac8fa, #7b3fe4, #ff453a)",
        outline: selected ? "2px solid #fff" : "none",
        outlineOffset: 1,
      }}
    >
      <input type="color" aria-label={t("Benutzerdefiniert")} value={value} onChange={(e) => onPick(e.target.value)} className="absolute inset-0 cursor-pointer opacity-0" />
      {selected && <Check size={12} weight="bold" className="pointer-events-none text-white drop-shadow-[0_1px_1px_rgb(0_0_0/0.8)]" />}
    </label>
  );
}

function luminance(hex: string): number {
  const v = hex.replace("#", "");
  const full = v.length === 3 ? v.split("").map((c) => c + c).join("") : v;
  const r = parseInt(full.slice(0, 2), 16) / 255;
  const g = parseInt(full.slice(2, 4), 16) / 255;
  const b = parseInt(full.slice(4, 6), 16) / 255;
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
