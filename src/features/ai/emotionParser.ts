import { triggerCompanionMood, type CompanionMood } from "../companion/companionBrain";
import { settings } from "../../settings/store";

const EMOTION_MAP: Record<string, { mood: CompanionMood; label: string }> = {
  happy: { mood: "happy", label: "Happy" },
  joy: { mood: "happy", label: "Happy" },
  smile: { mood: "happy", label: "Happy" },
  cheerful: { mood: "happy", label: "Happy" },
  glad: { mood: "happy", label: "Happy" },

  curious: { mood: "curious", label: "Curious" },
  curios: { mood: "curious", label: "Curious" },
  wondering: { mood: "curious", label: "Curious" },
  intrigued: { mood: "curious", label: "Curious" },
  interested: { mood: "curious", label: "Curious" },
  question: { mood: "curious", label: "Curious" },

  thinking: { mood: "studying", label: "Thinking" },
  studying: { mood: "studying", label: "Studying" },
  pondering: { mood: "studying", label: "Pondering" },
  analyzing: { mood: "studying", label: "Analyzing" },
  focused: { mood: "studying", label: "Focused" },

  vibing: { mood: "vibing", label: "Vibing" },
  cool: { mood: "vibing", label: "Vibing" },
  groovy: { mood: "vibing", label: "Vibing" },
  chill: { mood: "vibing-chill", label: "Chill" },

  excited: { mood: "vibing-hard", label: "Excited" },
  amazed: { mood: "vibing-hard", label: "Amazed" },
  hyped: { mood: "vibing-super", label: "Hyped" },
  wow: { mood: "vibing-hard", label: "Amazed" },

  sleepy: { mood: "sleepy", label: "Sleepy" },
  tired: { mood: "sleepy", label: "Sleepy" },
  calm: { mood: "sleepy", label: "Calm" },
  yawn: { mood: "yawn", label: "Yawning" },

  surprised: { mood: "winking", label: "Surprised" },
  winking: { mood: "winking", label: "Winking" },
  wink: { mood: "winking", label: "Winking" },
  playful: { mood: "winking", label: "Playful" },
  clever: { mood: "winking", label: "Clever" },

  sad: { mood: "sad", label: "Sad" },
  sorry: { mood: "sad", label: "Sorry" },
  empathetic: { mood: "sad", label: "Empathetic" },

  angry: { mood: "angry", label: "Intense" },
  frustrated: { mood: "angry", label: "Frustrated" },

  love: { mood: "petting", label: "Happy" },
  affectionate: { mood: "petting", label: "Warm" },
  sweet: { mood: "petting", label: "Sweet" },

  laughing: { mood: "tickled", label: "Laughing" },
  funny: { mood: "tickled", label: "Amused" },
  amused: { mood: "tickled", label: "Amused" },
  giggle: { mood: "tickled", label: "Giggling" },

  proud: { mood: "butler-bow", label: "Proud" },
  bow: { mood: "butler-bow", label: "Polite" },
  polite: { mood: "butler-bow", label: "Polite" },
  welcome: { mood: "butler-bow", label: "Welcoming" },
  celebrate: { mood: "celebrate", label: "Celebrating" },
  party: { mood: "celebrate", label: "Party" },
};

const EMOTION_KEYS_PATTERN = Object.keys(EMOTION_MAP).join("|");

/**
 * Matches either `[[Happy]]`, `[Happy]`, or `<Happy>` (case-insensitive)
 */
const EMOTION_TAG_REGEX = new RegExp(
  `(?:\\[\\[\\s*(${EMOTION_KEYS_PATTERN})\\s*\\]\\]|\\[\\s*(${EMOTION_KEYS_PATTERN})\\s*\\]|<\\s*(${EMOTION_KEYS_PATTERN})\\s*>)`,
  "gi"
);

/**
 * Matches trailing partial emotion tags at the very end of a streaming string
 * so half-typed tags like `[[Hap` or `<Cur` never flicker in the UI.
 */
const TRAILING_PARTIAL_TAG_REGEX = /(?:\[\[[A-Za-z\s]{0,16}|<(?![/a-z0-9]+\s*>)[A-Za-z]{1,14})$/;

/**
 * Per-emotion visibility durations in milliseconds.
 * Gives meaningful reactions ample time to be perceived and appreciated:
 * - Complex/deep thinking: 35s
 * - Sleepy/peaceful: 25s
 * - Curious/wondering: 15s
 * - Music grooving: 14s
 * - Hype/excitement: 12s
 * - Sad/empathetic: 10s
 * - Happy/affectionate: 8s
 * - Quick giggles/winks/bows: 6.5s-7s
 */
const MOOD_DURATIONS: Record<CompanionMood, number> = {
  studying: 35000,
  sleepy: 25000,
  yawn: 8000,
  curious: 15000,
  vibing: 14000,
  "vibing-chill": 14000,
  "vibing-hard": 12000,
  "vibing-super": 12000,
  sad: 10000,
  happy: 8000,
  petting: 8000,
  tickled: 7000,
  winking: 6500,
  "butler-bow": 6500,
  angry: 9000,
  listening: 15000,
  sneeze: 3000,
  smelting: 10000,
  hungry: 8000,
  stamp: 4000,
  celebrate: 8000,
};

export function getEmotionDuration(mood: CompanionMood): number {
  return MOOD_DURATIONS[mood] ?? 8000;
}

/**
 * Wraps the user's prompt with instructions and companion self-awareness so Gemini
 * understands who it is, embeds leading companion emotion tags, and matches response
 * length to question depth.
 */
export function buildEmotionPrompt(userPrompt: string): string {
  const comp = settings.get().companion;
  const name = comp.name?.trim() || "Companion";
  const shape = comp.shape || "circle";
  const color = comp.color || "white";
  const hatDesc = comp.hat && comp.hat !== "none" ? ` wearing a ${comp.hat}` : "";
  const eyewearDesc = comp.eyewear && comp.eyewear !== "none" ? ` wearing ${comp.eyewear}` : "";
  const accessories = `${hatDesc}${hatDesc && eyewearDesc ? " and" : ""}${eyewearDesc}`.trim();
  const physicalDesc = accessories ? `${color} ${shape} (${accessories})` : `${color} ${shape}`;

  return [
    `[Context: You are ${name}, a desktop assistant residing alongside an animated companion widget (${physicalDesc}) in the top screen notch. Do NOT roleplay, introduce yourself, or mention your body, shape, or the notch unless the user explicitly asks about you or your appearance.]`,
    `[Instruction: Choose ONE fitting emotion tag at the very start of your response from: [[Happy]], [[Curious]], [[Thinking]], [[Vibing]], [[Excited]], [[Winking]], [[Laughing]], [[Proud]], [[Sleepy]], [[Sad]].`,
    `Output ONLY the leading emotion tag followed by your direct response. Be direct, natural, and concise: keep answers brief for simple questions and utility tasks; elaborate thoroughly only when a deeper explanation is requested.]`,
    "",
    userPrompt.trim(),
  ].join("\n");
}

export interface EmotionScanResult {
  seenCount: number;
  mood: CompanionMood | null;
  label: string | null;
}

/**
 * Scans streaming text for newly arrived emotion tags and fires `triggerCompanionMood`
 * with calibrated durations whenever a new tag appears in the stream.
 */
export function scanAndTriggerEmotions(rawText: string, previousCount: number): EmotionScanResult {
  const matches: { mood: CompanionMood; label: string }[] = [];
  EMOTION_TAG_REGEX.lastIndex = 0;

  let m: RegExpExecArray | null;
  while ((m = EMOTION_TAG_REGEX.exec(rawText)) !== null) {
    const rawKey = (m[1] || m[2] || m[3] || "").toLowerCase().trim();
    const mapped = EMOTION_MAP[rawKey];
    if (mapped) {
      matches.push(mapped);
    }
  }

  if (matches.length > previousCount) {
    const latest = matches[matches.length - 1];
    const duration = getEmotionDuration(latest.mood);
    triggerCompanionMood(latest.mood, duration);
    return {
      seenCount: matches.length,
      mood: latest.mood,
      label: latest.label,
    };
  }

  const current = matches.length > 0 ? matches[matches.length - 1] : null;
  return {
    seenCount: matches.length,
    mood: current?.mood ?? null,
    label: current?.label ?? null,
  };
}

/**
 * Strips all companion emotion tags (`[[Happy]]`, `[Happy]`, `<Happy>`), prompt echoes,
 * and trailing partial tags from the text so the user sees clean Markdown.
 */
export function stripEmotionTags(rawText: string, isStreaming = false): string {
  let cleaned = rawText
    .replace(/\[(?:System|Instruction|System Instruction|Context):[\s\S]*?\]\s*/gi, "")
    .replace(EMOTION_TAG_REGEX, "");

  if (isStreaming) {
    cleaned = cleaned.replace(TRAILING_PARTIAL_TAG_REGEX, "");
  }

  // Clean up double spaces left behind where tags were removed, preserving newlines
  return cleaned
    .replace(/[ \t]{2,}/g, " ")
    .replace(/^ +/gm, "")
    .trim();
}
