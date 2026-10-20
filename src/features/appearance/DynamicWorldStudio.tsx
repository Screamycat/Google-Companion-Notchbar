import { Globe, Sparkle, CloudRain, Tree, Lightning } from "@phosphor-icons/react";
import { settings, updateSettings, DEFAULT_DYNAMIC_WORLD, type DynamicWorldConfig } from "../../settings/store";
import { Group, Row, Segmented, Switch } from "../../ui/controls";
import { t } from "../../i18n";

function StudioRow({
  label,
  hint,
  children,
  stacked = false,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
  stacked?: boolean;
}) {
  if (stacked) {
    return (
      <div className="flex flex-col gap-2 px-3 py-2.5 border-t border-separator first:border-t-0">
        <div className="flex flex-col min-w-0">
          <span className="text-body font-medium text-label">{label}</span>
          {hint && <span className="text-[11px] text-label-3 leading-snug">{hint}</span>}
        </div>
        <div className="w-full flex items-center justify-start overflow-x-auto [scrollbar-width:none]">
          {children}
        </div>
      </div>
    );
  }
  return <Row label={label} hint={hint}>{children}</Row>;
}

export function DynamicWorldStudio() {
  const currentWorld = settings.use().appearance.dynamicWorld ?? DEFAULT_DYNAMIC_WORLD;

  const setWorld = (patch: Partial<DynamicWorldConfig>) => {
    updateSettings((s) => ({
      appearance: {
        ...s.appearance,
        dynamicWorld: {
          ...(s.appearance.dynamicWorld ?? DEFAULT_DYNAMIC_WORLD),
          ...patch,
        },
      },
    }));
  };

  const applyPreset = (preset: Partial<DynamicWorldConfig>) => {
    setWorld(preset);
  };

  return (
    <div className="flex flex-col gap-3">
      {/* 1. Quick Presets */}
      <Group title={t("Studio-Voreinstellungen")}>
        <div className="flex flex-wrap gap-1.5 p-2.5">
          <button
            type="button"
            onClick={() =>
              applyPreset({
                timeMode: "auto",
                weatherMode: "auto",
                celestial: "auto",
                stars: "subtle",
                aurora: false,
                horizon: "mountains",
                audioReactive: true,
              })
            }
            className="flex items-center gap-1.5 rounded-full bg-fill-2 px-3 py-1.5 text-caption font-medium text-label hover:bg-fill-3 active:scale-95 transition"
          >
            <Globe size={13} weight="bold" className="text-sky-400" />
            {t("Echtzeit-Synchronisierung")}
          </button>

          <button
            type="button"
            onClick={() =>
              applyPreset({
                timeMode: "night",
                weatherMode: "manual",
                rain: "medium",
                snow: "off",
                clouds: "overcast",
                thunder: false,
                windLeaves: false,
                celestial: "moon",
                stars: "subtle",
                aurora: false,
                horizon: "none",
                audioReactive: true,
              })
            }
            className="flex items-center gap-1.5 rounded-full bg-fill-2 px-3 py-1.5 text-caption font-medium text-label hover:bg-fill-3 active:scale-95 transition"
          >
            <CloudRain size={13} weight="bold" className="text-cyan-400" />
            {t("Gemütliche Regennacht")}
          </button>

          <button
            type="button"
            onClick={() =>
              applyPreset({
                timeMode: "dusk",
                weatherMode: "manual",
                snow: "light",
                rain: "off",
                clouds: "fog",
                thunder: false,
                windLeaves: false,
                celestial: "moon",
                stars: "meteors",
                aurora: false,
                horizon: "mountains",
                audioReactive: true,
              })
            }
            className="flex items-center gap-1.5 rounded-full bg-fill-2 px-3 py-1.5 text-caption font-medium text-label hover:bg-fill-3 active:scale-95 transition"
          >
            <Sparkle size={13} weight="bold" className="text-indigo-300" />
            {t("Alpines Winter-Dämmern")}
          </button>

          <button
            type="button"
            onClick={() =>
              applyPreset({
                timeMode: "sunset",
                weatherMode: "manual",
                windLeaves: true,
                rain: "off",
                snow: "off",
                clouds: "scattered",
                thunder: false,
                celestial: "sun",
                stars: "off",
                aurora: false,
                horizon: "treehouse",
                audioReactive: true,
              })
            }
            className="flex items-center gap-1.5 rounded-full bg-fill-2 px-3 py-1.5 text-caption font-medium text-label hover:bg-fill-3 active:scale-95 transition"
          >
            <Tree size={13} weight="bold" className="text-amber-400" />
            {t("Ghibli Sonnenuntergang")}
          </button>

          <button
            type="button"
            onClick={() =>
              applyPreset({
                timeMode: "night",
                weatherMode: "manual",
                rain: "heavy",
                thunder: true,
                windLeaves: false,
                clouds: "overcast",
                celestial: "off",
                stars: "off",
                aurora: false,
                horizon: "city",
                audioReactive: true,
              })
            }
            className="flex items-center gap-1.5 rounded-full bg-fill-2 px-3 py-1.5 text-caption font-medium text-label hover:bg-fill-3 active:scale-95 transition"
          >
            <Lightning size={13} weight="bold" className="text-yellow-400" />
            {t("Cyber Gewittersturm")}
          </button>

          <button
            type="button"
            onClick={() =>
              applyPreset({
                timeMode: "night",
                weatherMode: "manual",
                aurora: true,
                celestial: "moon",
                stars: "dense",
                rain: "off",
                snow: "off",
                clouds: "clear",
                thunder: false,
                windLeaves: false,
                horizon: "ocean",
                audioReactive: true,
              })
            }
            className="flex items-center gap-1.5 rounded-full bg-fill-2 px-3 py-1.5 text-caption font-medium text-label hover:bg-fill-3 active:scale-95 transition"
          >
            <Sparkle size={13} weight="bold" className="text-emerald-400" />
            {t("Kosmische Nordlichter")}
          </button>
        </div>
      </Group>

      {/* 2. Time & Sky Cycle */}
      <Group title={t("Tageszeit & Himmelsbeleuchtung")}>
        <StudioRow
          stacked
          label={t("Tageszeit")}
          hint={t("Folgt der echten Uhrzeit oder fixiert die Lichtstimmung")}
        >
          <Segmented
            id="dw-time"
            size="sm"
            value={currentWorld.timeMode}
            onChange={(timeMode) => setWorld({ timeMode })}
            options={[
              { value: "auto", label: t("Echtzeit") },
              { value: "dawn", label: t("Morgen") },
              { value: "day", label: t("Tag") },
              { value: "sunset", label: t("Abendrot") },
              { value: "dusk", label: t("Dämmerung") },
              { value: "night", label: t("Nacht") },
            ]}
          />
        </StudioRow>
      </Group>

      {/* 3. Weather Simulation */}
      <Group title={t("Wetter-Engine")}>
        <StudioRow
          label={t("Wetterquelle")}
          hint={t("Echtzeit-Standortdaten oder manuell konfigurieren")}
        >
          <Segmented
            id="dw-weather-mode"
            size="sm"
            value={currentWorld.weatherMode}
            onChange={(weatherMode) => setWorld({ weatherMode })}
            options={[
              { value: "auto", label: t("Echtzeit") },
              { value: "manual", label: t("Manuell") },
            ]}
          />
        </StudioRow>

        {currentWorld.weatherMode === "manual" && (
          <>
            <StudioRow
              stacked
              label={t("Regen")}
              hint={t("Fließende Regentropfen & Scheibenkondensation")}
            >
              <Segmented
                id="dw-rain"
                size="sm"
                value={currentWorld.rain}
                onChange={(rain) => setWorld({ rain })}
                options={[
                  { value: "off", label: t("Aus") },
                  { value: "light", label: t("Niesel") },
                  { value: "medium", label: t("Mittel") },
                  { value: "heavy", label: t("Stark") },
                ]}
              />
            </StudioRow>

            <StudioRow
              label={t("Schnee")}
              hint={t("Sanft schwebende Schneeflocken")}
            >
              <Segmented
                id="dw-snow"
                size="sm"
                value={currentWorld.snow}
                onChange={(snow) => setWorld({ snow })}
                options={[
                  { value: "off", label: t("Aus") },
                  { value: "light", label: t("Leicht") },
                  { value: "heavy", label: t("Dicht") },
                ]}
              />
            </StudioRow>

            <StudioRow
              stacked
              label={t("Wolken & Nebel")}
              hint={t("Vorüberziehende Dunstwolken und Bodennebel")}
            >
              <Segmented
                id="dw-clouds"
                size="sm"
                value={currentWorld.clouds}
                onChange={(clouds) => setWorld({ clouds })}
                options={[
                  { value: "clear", label: t("Klar") },
                  { value: "scattered", label: t("Leicht") },
                  { value: "overcast", label: t("Bedeckt") },
                  { value: "fog", label: t("Nebel") },
                ]}
              />
            </StudioRow>

            <StudioRow
              label={t("Gewitter & Blitze")}
              hint={t("Atmosphärische Blitze bei Gewitter oder Audio-Peaks")}
            >
              <Switch
                label={t("Gewitter & Blitze")}
                checked={currentWorld.thunder}
                onChange={(thunder) => setWorld({ thunder })}
              />
            </StudioRow>

            <StudioRow
              label={t("Wind & Blätter")}
              hint={t("Herbstlaub und Blütenblätter wehen im Wind")}
            >
              <Switch
                label={t("Wind & Blätter")}
                checked={currentWorld.windLeaves}
                onChange={(windLeaves) => setWorld({ windLeaves })}
              />
            </StudioRow>
          </>
        )}
      </Group>

      {/* 4. Celestial & Cosmic */}
      <Group title={t("Gestirne & Himmel")}>
        <StudioRow
          stacked
          label={t("Sonne & Mond")}
          hint={t("Automatisch nach Tageszeit oder manuell gewählt")}
        >
          <Segmented
            id="dw-celestial"
            size="sm"
            value={currentWorld.celestial}
            onChange={(celestial) => setWorld({ celestial })}
            options={[
              { value: "auto", label: t("Auto") },
              { value: "sun", label: t("Sonne") },
              { value: "moon", label: t("Mond") },
              { value: "off", label: t("Aus") },
            ]}
          />
        </StudioRow>

        <StudioRow
          stacked
          label={t("Sterne & Meteore")}
          hint={t("Sternenstaub und seltene Sternschnuppen")}
        >
          <Segmented
            id="dw-stars"
            size="sm"
            value={currentWorld.stars}
            onChange={(stars) => setWorld({ stars })}
            options={[
              { value: "off", label: t("Aus") },
              { value: "subtle", label: t("Dezent") },
              { value: "dense", label: t("Viele") },
              { value: "meteors", label: t("Schnuppen") },
            ]}
          />
        </StudioRow>

        <StudioRow
          label={t("Nordlichter (Aurora)")}
          hint={t("Schimmernde Polarlichter im oberen Himmel")}
        >
          <Switch
            label={t("Nordlichter (Aurora)")}
            checked={currentWorld.aurora}
            onChange={(aurora) => setWorld({ aurora })}
          />
        </StudioRow>
      </Group>

      {/* 5. Horizon & Scenery */}
      <Group title={t("Horizont & Kulisse")}>
        <StudioRow
          stacked
          label={t("Landschaft")}
          hint={t("Wähle die Silhouette am unteren Horizont")}
        >
          <Segmented
            id="dw-horizon"
            size="sm"
            value={currentWorld.horizon}
            onChange={(horizon) => setWorld({ horizon })}
            options={[
              { value: "none", label: t("Keine") },
              { value: "mountains", label: t("Berge") },
              { value: "treehouse", label: t("Baumhaus") },
              { value: "city", label: t("Skyline") },
              { value: "ocean", label: t("Ozean") },
            ]}
          />
        </StudioRow>
      </Group>

      {/* 6. Music Reactivity */}
      <Group title={t("Audio-Reaktivität")}>
        <StudioRow
          label={t("Musik-Reaktivität")}
          hint={t("Blitze, Polarlichter und Gestirne reagieren auf Musik")}
        >
          <Switch
            label={t("Musik-Reaktivität")}
            checked={currentWorld.audioReactive}
            onChange={(audioReactive) => setWorld({ audioReactive })}
          />
        </StudioRow>
      </Group>
    </div>
  );
}
