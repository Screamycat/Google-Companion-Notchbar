import { useEffect, useRef, useState } from "react";
import type { NowPlaying } from "../../platform/media";
import { audioLevelsAvailable, subscribeLevels, type Levels } from "../../platform/audio";
import { settings } from "../../settings/store";

export type CompanionMood =
  | "happy"
  | "curious"
  | "vibing"
  | "vibing-chill"
  | "vibing-hard"
  | "vibing-super"
  | "studying"
  | "listening"
  | "sleepy"
  | "angry"
  | "sad"
  | "winking"
  | "petting"
  | "tickled"
  | "yawn"
  | "sneeze"
  | "smelting"
  | "hungry"
  | "stamp"
  | "butler-bow";


export function triggerCompanionMood(mood: CompanionMood, durationMs = 2000) {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("companion:mood", { detail: { mood, duration: durationMs } }));
  }
}

export interface AudioClassification {
  isAudioActive: boolean;
  isMusic: boolean;
  isPodcast: boolean;
  isLofiStudy: boolean;
  isChill: boolean;
  isHardcore: boolean;
  grooveLevel: 1 | 2 | 3; // 1 = Chill Slow Swing, 2 = Hard Groove, 3 = Hyper Hype / Hardstyle / Bass Drop
  statusHint: string;
}

// Live musical excitement score (0..100) broadcast to settings preview
let liveEnergyScore = 0;
const energyListeners = new Set<(score: number) => void>();

export function getLiveMusicEnergy(): number {
  return liveEnergyScore;
}

export function subscribeLiveMusicEnergy(cb: (score: number) => void): () => void {
  energyListeners.add(cb);
  cb(liveEnergyScore);
  return () => {
    energyListeners.delete(cb);
  };
}

export function useLiveMusicEnergy(): number {
  const [energy, setEnergy] = useState(getLiveMusicEnergy);
  useEffect(() => subscribeLiveMusicEnergy(setEnergy), []);
  return energy;
}

const PODCAST_KEYWORDS =
  /\b(podcast|episode|ep\.?\s*\d+|audiobook|chapter|interview|commentary|lecture|stand-up|discussion|ted talk|speech|news|radio show|review|deep dive|talk show)\b/i;

const HARDSTYLE_KEYWORDS =
  /\b(hardstyle|bass boost|bassboost|bass drop|beat drop|drop|dubstep|phonk|dnb|drum and bass|rave|hardcore|speed up|nightcore|metal|heavy metal|trap beat|cyberpunk|industrial|hard dance)\b/i;

const LOFI_STUDY_KEYWORDS =
  /\b(lofi|lo-fi|chillhop|study|studying|homework|reading|focus|coding|study beats|lofi hip hop)\b/i;

const CHILL_KEYWORDS =
  /\b(chill|ambient|ambience|acoustic|piano|sleep|relax|relaxing|calm|calming|meditation|slowed|downtempo|jazz|rain|peaceful|soft|coffee|minecraft|nature|quiet|serene|soothing|wilderness|healing|spa|deep sleep|zen|yoga|harp|flute|instrumental relaxation)\b/i;

const MUSIC_KEYWORDS =
  /\b(music|song|track|audio|soundtrack|ost|mix|mashup|remix|lofi|lo-fi|beats|synthwave|chillhop|dj set|playlist|bass|ambient|album|live set|radio|instrumental|vocal|feat\.|prod\.|official audio|official video|lyrics|edm|house|dubstep|trap|rap|hip-?hop|pop|rock|metal|techno|dance|phonk|dnb|synth|electro|future bass|hardstyle|orchestral)\b/i;

/**
 * Smart Audio Classifier:
 * Intelligently recognizes Music vs Podcasts & Spoken Word, even for 10-hour YouTube mashups!
 * Accurately detects:
 * - Level 3: Hardstyle / Bass Drops / Phonk / Fast BPM
 * - LOFI: Study Mode
 * - Level 1: Relaxing / Chill / Minecraft / Slow Swing
 * - Level 2: Standard Upbeat Pop & Rock Groove
 */
export function classifyAudio(np: NowPlaying | null): AudioClassification {
  if (!np || !np.isPlaying) {
    return {
      isAudioActive: false,
      isMusic: false,
      isPodcast: false,
      isLofiStudy: false,
      isChill: false,
      isHardcore: false,
      grooveLevel: 1,
      statusHint: "",
    };
  }

  const text = `${np.title ?? ""} ${np.artist ?? ""}`.trim();
  const hasPodcastKeyword = PODCAST_KEYWORDS.test(text);
  const hasMusicKeyword = MUSIC_KEYWORDS.test(text);

  // If text has podcast keywords and NO music keywords -> Podcast / Spoken word
  if (hasPodcastKeyword && !hasMusicKeyword) {
    return {
      isAudioActive: true,
      isMusic: false,
      isPodcast: true,
      isLofiStudy: false,
      isChill: false,
      isHardcore: false,
      grooveLevel: 1,
      statusHint: "Listening to podcast…",
    };
  }

  // 1. Level 3: Hardstyle, Bass Drops, Heavy Phonk, DnB, Hard Dance
  if (HARDSTYLE_KEYWORDS.test(text)) {
    return {
      isAudioActive: true,
      isMusic: true,
      isPodcast: false,
      isLofiStudy: false,
      isChill: false,
      isHardcore: true,
      grooveLevel: 3,
      statusHint: "HARDCORE GROOVE! ⚡",
    };
  }

  // 2. LOFI / Study Mode: Study animation
  if (LOFI_STUDY_KEYWORDS.test(text)) {
    return {
      isAudioActive: true,
      isMusic: true,
      isPodcast: false,
      isLofiStudy: true,
      isChill: true,
      isHardcore: false,
      grooveLevel: 1,
      statusHint: "Studying to lofi 📖",
    };
  }

  // 3. Level 1: Relaxing, Ambient, Minecraft, Acoustic, Sleep, Slow Swing
  if (CHILL_KEYWORDS.test(text)) {
    return {
      isAudioActive: true,
      isMusic: true,
      isPodcast: false,
      isLofiStudy: false,
      isChill: true,
      isHardcore: false,
      grooveLevel: 1,
      statusHint: "Swaying to the music ♪",
    };
  }

  // 4. Music Keywords matched (including 10h mixes, remixes, mashups) -> Upbeat Level 2
  if (hasMusicKeyword) {
    return {
      isAudioActive: true,
      isMusic: true,
      isPodcast: false,
      isLofiStudy: false,
      isChill: false,
      isHardcore: false,
      grooveLevel: 2,
      statusHint: "Jamming to the beat ♫",
    };
  }

  // If duration is extremely long (> 20 mins) without any music indicators -> likely a podcast or lecture
  if (np.duration > 1200) {
    return {
      isAudioActive: true,
      isMusic: false,
      isPodcast: true,
      isLofiStudy: false,
      isChill: false,
      isHardcore: false,
      grooveLevel: 1,
      statusHint: "Listening intently…",
    };
  }

  // Standard songs / music playback fallback -> Level 1 (calm start until dynamic audio analyzer detects energy)
  return {
    isAudioActive: true,
    isMusic: true,
    isPodcast: false,
    isLofiStudy: false,
    isChill: false,
    isHardcore: false,
    grooveLevel: 1,
    statusHint: "Swaying to the music ♪",
  };
}

export type DaydreamEmoji = "🍕" | "⭐" | "🎮" | "☕" | "✨" | "💤" | "🍩" | "🎧" | "🚀";
const DAYDREAM_CHOICES: DaydreamEmoji[] = ["🍕", "⭐", "🎮", "☕", "✨", "💤", "🍩", "🎧", "🚀"];

export interface CompanionBrainState {
  mood: CompanionMood;
  look: { x: number; y: number };
  blink: boolean;
  daydream: DaydreamEmoji | null;
  audioInfo: AudioClassification;
  onPointerMove: (e: React.PointerEvent<HTMLDivElement> | PointerEvent, rect?: DOMRect) => void;
  onPointerLeave: () => void;
  onClick: (e?: React.MouseEvent) => void;
}

export const MIN_MOOD_DURATION_MS: Record<CompanionMood, number> = {
  petting: 1800,
  tickled: 1500,
  yawn: 2200,
  sneeze: 1800,
  angry: 2400,
  sad: 2000,
  winking: 650,
  curious: 900,
  sleepy: 2500,
  studying: 1600,
  listening: 1600,
  "vibing-super": 1400,
  "vibing-hard": 1200,
  "vibing-chill": 1200,
  vibing: 1200,
  smelting: 1800,
  hungry: 1500,
  stamp: 1300,
  "butler-bow": 1200,
  happy: 0,
};

/**
 * Autonomous Tamagotchi Brain:
 * Orchestrates emotions with guaranteed minimum display durations to eliminate jitter,
 * natural idle random events, deliberate petting & tickling, and intelligent 3-tier groove vibing.
 */
export function useCompanionBrain({
  np,
  isMusicTab = false,
  ambientCenter,
}: {
  np: NowPlaying | null;
  isMusicTab?: boolean;
  ambientCenter?: { x: number; y: number };
}): CompanionBrainState {
  const audioInfo = classifyAudio(np);
  const isAudioActive = Boolean(np && np.isPlaying && audioInfo.isAudioActive);
  const isMusicPlaying = Boolean(isAudioActive && audioInfo.isMusic);

  const companionCustomization = settings.use().companion;
  const grooveThreshold = companionCustomization.grooveThreshold ?? 35;
  const dropThreshold = companionCustomization.dropThreshold ?? 65;

  // Real-time dynamic groove level from live audio output analysis (levels 1, 2, 3)
  const [liveGrooveLevel, setLiveGrooveLevel] = useState<1 | 2 | 3>(() => audioInfo.grooveLevel);

  const [mood, setMood] = useState<CompanionMood>("happy");
  const [blink, setBlink] = useState(false);
  const [look, setLook] = useState({ x: 0, y: 0 });
  const [daydream, setDaydream] = useState<DaydreamEmoji | null>(null);

  const isDirectlyHoveredRef = useRef(false);
  const currentMoodRef = useRef<CompanionMood>("happy");
  const moodLockedUntilRef = useRef<number>(0);
  const lockTimerRef = useRef<number | undefined>(undefined);
  const pokeCountRef = useRef(0);
  const lastPointerRef = useRef<{
    x: number;
    y: number;
    time: number;
    dirChanges: number;
    lastSign: number;
    totalDist: number;
  }>({
    x: 0,
    y: 0,
    time: 0,
    dirChanges: 0,
    lastSign: 0,
    totalDist: 0,
  });
  const eventTimerRef = useRef<number | undefined>(undefined);

  // Audio level energy tracker refs
  const beatEnvRef = useRef(0.05);
  const fullnessEnvRef = useRef(0.1);
  const pulseEnvRef = useRef(0.05);
  const bassFloorRef = useRef(0.25);
  const lowMidFloorRef = useRef(0.25);
  const prevBandsRef = useRef<Levels>([0, 0, 0, 0]);
  const silenceElapsedRef = useRef(0);
  const hasReceivedSignalRef = useRef(false);
  const currentLevelRef = useRef<1 | 2 | 3>(audioInfo.grooveLevel);
  const levelDwellUntilRef = useRef<number>(0);
  const lastAudioTickRef = useRef<number>(performance.now());
  const prevThresholdsRef = useRef({ groove: grooveThreshold, drop: dropThreshold });
  if (
    prevThresholdsRef.current.groove !== grooveThreshold ||
    prevThresholdsRef.current.drop !== dropThreshold
  ) {
    prevThresholdsRef.current = { groove: grooveThreshold, drop: dropThreshold };
    levelDwellUntilRef.current = 0; // Immediately allow vibe transition when user adjusts sliders
  }

  // Computes base background emotion from audio or idling
  const getAmbientMood = (groove: 1 | 2 | 3 = liveGrooveLevel): CompanionMood => {
    if (isAudioActive) {
      if (audioInfo.isPodcast) return "listening";
      if (audioInfo.isLofiStudy) return "studying";
      if (groove === 3) return "vibing-super";
      if (groove === 2) return "vibing-hard";
      return "vibing-chill";
    }
    return "happy";
  };

  // Triggers an emotion and locks it for its minimum duration to avoid rapid back-and-forth jitter
  const triggerMood = (newMood: CompanionMood, customDurationMs?: number, force = false) => {
    const now = performance.now();
    if (!force && now < moodLockedUntilRef.current) {
      return; // Emotion is currently locked for its minimum duration!
    }

    const duration = customDurationMs ?? MIN_MOOD_DURATION_MS[newMood] ?? 0;
    moodLockedUntilRef.current = now + duration;
    currentMoodRef.current = newMood;
    setMood(newMood);

    window.clearTimeout(lockTimerRef.current);
    if (duration > 0) {
      lockTimerRef.current = window.setTimeout(() => {
        moodLockedUntilRef.current = 0;
        const target = isDirectlyHoveredRef.current
          ? (isAudioActive ? getAmbientMood() : "curious")
          : getAmbientMood();
        currentMoodRef.current = target;
        setMood(target);
      }, duration);
    }
  };

  const triggerMoodRef = useRef(triggerMood);
  triggerMoodRef.current = triggerMood;

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<{ mood: CompanionMood; duration: number }>).detail;
      if (detail?.mood) {
        triggerMoodRef.current(detail.mood, detail.duration, true);
      }
    };
    window.addEventListener("companion:mood", handler);
    return () => window.removeEventListener("companion:mood", handler);
  }, []);

  // 0. Real-time Audio Listener: WASAPI loopback FFT energy, beat envelope & spectral flux analysis
  // Listens directly to the music track and dynamically shifts between:
  // - Level 1 (Chill Slow Swing): quiet intros, acoustic parts, slow ambient breakdowns
  // - Level 2 (Hard Groove): regular verses, rhythmic drum beat, standard tempo
  // - Level 3 (Super Hype / Bass Drop): heavy bass drops, intense choruses, climaxes, fast beats
  useEffect(() => {
    if (!isMusicPlaying || audioInfo.isPodcast || audioInfo.isLofiStudy) {
      if (audioInfo.isPodcast || audioInfo.isLofiStudy) {
        setLiveGrooveLevel(1);
        currentLevelRef.current = 1;
      }
      return;
    }

    if (audioLevelsAvailable) {
      lastAudioTickRef.current = performance.now();
      silenceElapsedRef.current = 0;

      const unsubscribe = subscribeLevels((values: Levels) => {
        const now = performance.now();
        const dt = Math.min(0.1, Math.max(0.005, (now - lastAudioTickRef.current) / 1000));
        lastAudioTickRef.current = now;

        const bass = values[0];
        const lowMid = values[1];
        const midHigh = values[2];
        const treble = values[3];

        // Sort bands descending to find the strongest active band
        const sorted = [bass, lowMid, midHigh, treble].sort((a, b) => b - a);
        const topBand = sorted[0];

        // Handle pure-zero frames (e.g. initial stream warm-up or uncaptured secondary device)
        if (topBand < 0.008) {
          prevBandsRef.current = [bass, lowMid, midHigh, treble];
          silenceElapsedRef.current += dt;
          if (silenceElapsedRef.current > 2.0 && currentLevelRef.current !== 1) {
            currentLevelRef.current = 1;
            setLiveGrooveLevel(1);
          }
          return;
        } else {
          if (!hasReceivedSignalRef.current) {
            hasReceivedSignalRef.current = true;
            levelDwellUntilRef.current = 0; // Immediate response on first audio frame
          }
          silenceElapsedRef.current = 0;
        }

        // 1. Slow-moving baseline / floor tracker for bass and low-mid:
        // Adapts slowly (tau ~ 1.5s) to sustained notes, pads, and background noise.
        const bassFloorTau = bass > bassFloorRef.current ? 1.5 : 0.8;
        bassFloorRef.current += (bass - bassFloorRef.current) * (1 - Math.exp(-dt / bassFloorTau));

        const lowMidFloorTau = lowMid > lowMidFloorRef.current ? 1.5 : 0.8;
        lowMidFloorRef.current += (lowMid - lowMidFloorRef.current) * (1 - Math.exp(-dt / lowMidFloorTau));

        // 2. Rhythmic Transient Impulses (spikes above the moving baseline):
        // In continuous ambient music (violins, flutes, pads), bass stays close to baseline -> impulse ~ 0!
        // In drum-driven music (kick, snare, bass drop), bass punches far above baseline -> impulse ~ 0.4 - 0.8!
        const bassImpulse = Math.max(0, bass - bassFloorRef.current);
        const lowMidImpulse = Math.max(0, lowMid - lowMidFloorRef.current);

        // 3. Spectral Flux / Onset Transient (attack speed from frame to frame)
        const prev = prevBandsRef.current;
        const onsetFlux =
          Math.max(0, bass - prev[0]) * 1.8 +
          Math.max(0, lowMid - prev[1]) * 1.3 +
          Math.max(0, midHigh - prev[2]) * 0.7 +
          Math.max(0, treble - prev[3]) * 0.5;
        prevBandsRef.current = [bass, lowMid, midHigh, treble];

        // 4. Dynamic Percussive Energy (true beat punch):
        // If there are real drum transients and rhythmic impulses, beat punch is high.
        // If the sound is steady/continuous without transient spikes, beat punch is near 0.
        const instantBeatPunch = Math.min(1.0, (bassImpulse * 1.6 + lowMidImpulse * 1.1 + onsetFlux * 1.4));

        // 5. Envelope follower on beat punch:
        // Fast attack (45ms) catches kicks/snares instantly; decay (650ms) bridges between rhythmic beats.
        // If no drum strikes for > 650ms, beat energy drains down!
        const beatTau = instantBeatPunch > beatEnvRef.current ? 0.045 : 0.65;
        beatEnvRef.current += (instantBeatPunch - beatEnvRef.current) * (1 - Math.exp(-dt / beatTau));

        // 6. High-Frequency Sizzle / Rhythm Pulse (hi-hats, fast percussion)
        const rawPulse = Math.min(1.0, onsetFlux * 2.0);
        const pulseTau = rawPulse > pulseEnvRef.current ? 0.06 : 0.70;
        pulseEnvRef.current += (rawPulse - pulseEnvRef.current) * (1 - Math.exp(-dt / pulseTau));

        // 7. Fullness (multiband density, downweighted so it doesn't inflate quiet music)
        const bandWeighted = bass * 0.40 + lowMid * 0.30 + midHigh * 0.20 + treble * 0.10;
        fullnessEnvRef.current += (bandWeighted - fullnessEnvRef.current) * (1 - Math.exp(-dt / 0.85));

        // Combined raw excitement score (0..1)
        // 60% weight on actual rhythmic beats & transient impulses!
        // 25% weight on high-frequency onset pulse!
        // 15% weight on overall fullness!
        let rawExcitement =
          beatEnvRef.current * 0.60 +
          pulseEnvRef.current * 0.25 +
          fullnessEnvRef.current * 0.15;

        // If metadata explicitly indicates relaxing, peaceful, soothing, or meditation music:
        // Scale down so it stays calmly in Level 1 (unless an earthquake bass drop happens)
        if (audioInfo.isChill) {
          rawExcitement *= 0.35;
        } else if (audioInfo.isHardcore) {
          rawExcitement = Math.min(1.0, rawExcitement * 1.25 + 0.10);
        }

        const energy = Math.min(100, Math.max(0, Math.round(rawExcitement * 100)));

        if (energy !== liveEnergyScore) {
          liveEnergyScore = energy;
          energyListeners.forEach((l) => l(energy));
        }

        const l2 = Math.max(5, Math.min(95, grooveThreshold));
        const l3 = Math.max(l2 + 4, Math.min(100, dropThreshold));

        // Threshold checks on 0..100 energy scale - strictly governed by the unified energy score
        // Exactly matches the live needle displayed in Settings!
        const isDropHype = energy >= l3;
        const isGrooveUpbeat = energy >= l2;

        let nextLevel: 1 | 2 | 3 = currentLevelRef.current;

        if (currentLevelRef.current === 3) {
          // In Level 3 (Super Hype / Bass Drop):
          // Dwell for at least 1.8s, then step down when energy cools below Level 3 threshold (with 4-point hysteresis)
          const l3Exit = Math.max(l2, l3 - 4);
          if (now >= levelDwellUntilRef.current && energy < l3Exit) {
            nextLevel = isGrooveUpbeat ? 2 : 1;
            levelDwellUntilRef.current = now + 1000;
          }
        } else if (currentLevelRef.current === 2) {
          // In Level 2 (Standard Upbeat Groove):
          if (isDropHype) {
            nextLevel = 3;
            levelDwellUntilRef.current = now + 2000; // Lock Level 3 for at least 2.0s of hype!
          } else if (now >= levelDwellUntilRef.current && !isGrooveUpbeat && energy < Math.max(0, l2 - 4)) {
            // Calm intro, quiet breakdown, slow soft passage -> Level 1
            nextLevel = 1;
            levelDwellUntilRef.current = now + 1000;
          }
        } else {
          // In Level 1 (Chill Slow Swing):
          if (isDropHype) {
            nextLevel = 3;
            levelDwellUntilRef.current = now + 2000;
          } else if (now >= levelDwellUntilRef.current && isGrooveUpbeat) {
            nextLevel = 2;
            levelDwellUntilRef.current = now + 1000;
          }
        }

        if (nextLevel !== currentLevelRef.current) {
          currentLevelRef.current = nextLevel;
          setLiveGrooveLevel(nextLevel);
        }
      });

      return () => {
        unsubscribe();
        if (liveEnergyScore !== 0) {
          liveEnergyScore = 0;
          energyListeners.forEach((l) => l(0));
        }
      };
    } else {
      // Browser preview fallback: follow classified initial level
      setLiveGrooveLevel(audioInfo.grooveLevel);
      currentLevelRef.current = audioInfo.grooveLevel;
    }
  }, [isMusicPlaying, audioInfo.isPodcast, audioInfo.isLofiStudy, audioInfo.grooveLevel, dropThreshold, grooveThreshold]);

  // Synchronize companion mood with audio state and live groove level
  useEffect(() => {
    if (performance.now() < moodLockedUntilRef.current) {
      return; // Prioritize explicitly triggered mood (AI assistant, poke, etc.)!
    }
    const ambient = getAmbientMood(liveGrooveLevel);
    currentMoodRef.current = ambient;
    setMood(ambient);
    if (isMusicPlaying) {
      setLook({ x: 0, y: 0 }); // Center face and pupils during music
    }
  }, [isAudioActive, audioInfo.isPodcast, audioInfo.isLofiStudy, liveGrooveLevel, isMusicPlaying]);

  // 1. Ambient Window Cursor Tracking (when not hovering directly over BMO)
  useEffect(() => {
    if (!ambientCenter) return;
    const onAmbientMove = (e: PointerEvent) => {
      if (isDirectlyHoveredRef.current) return;
      if (isMusicPlaying) return; // Keep face centered in groove
      const dx = Math.max(-1, Math.min(1, (e.clientX - ambientCenter.x) / 220));
      const dy = Math.max(-1, Math.min(1, (e.clientY - ambientCenter.y) / 160));
      setLook({ x: dx, y: dy });
    };
    window.addEventListener("pointermove", onAmbientMove, { passive: true });
    return () => window.removeEventListener("pointermove", onAmbientMove);
  }, [ambientCenter?.x, ambientCenter?.y, isMusicPlaying]);

  // 2. Natural Blinking Loop (suppressed during music so eyes stay in groove)
  useEffect(() => {
    if (isMusicPlaying) return;
    let timeout: number;
    const scheduleBlink = () => {
      const next = 2400 + Math.random() * 2800;
      timeout = window.setTimeout(() => {
        setBlink(true);
        window.setTimeout(() => {
          setBlink(false);
          scheduleBlink();
        }, 130);
      }, next);
    };
    scheduleBlink();
    return () => window.clearTimeout(timeout);
  }, [isAudioActive, audioInfo.isMusic, isMusicTab]);

  // 3. Idle Living Engine: Random Micro-Events (Look-around, Daydream, Yawn, Stretch, Sneeze)
  useEffect(() => {
    if (isAudioActive) return;

    const scheduleRandomEvent = () => {
      const delay = 14000 + Math.random() * 16000;
      eventTimerRef.current = window.setTimeout(() => {
        if (performance.now() < moodLockedUntilRef.current) {
          scheduleRandomEvent();
          return;
        }

        const currentHour = new Date().getHours();
        const isLateNight = currentHour >= 23 || currentHour < 5;
        const isMorning = currentHour >= 7 && currentHour <= 10;

        const roll = Math.random();

        if (isLateNight && roll < 0.5) {
          triggerMood("sleepy", 3500);
          setDaydream("💤");
          window.setTimeout(() => setDaydream(null), 3200);
        } else if (roll < 0.22) {
          setLook({ x: -0.85, y: -0.1 });
          window.setTimeout(() => {
            setLook({ x: 0.85, y: 0.1 });
            window.setTimeout(() => {
              setLook({ x: 0, y: 0 });
            }, 1400);
          }, 1400);
        } else if (roll < 0.44) {
          // BMO pulls out his book to study / read for a few cozy moments!
          triggerMood("studying", 4200);
        } else if (roll < 0.68) {
          const emoji = isMorning && Math.random() < 0.5 ? "☕" : DAYDREAM_CHOICES[Math.floor(Math.random() * DAYDREAM_CHOICES.length)];
          setDaydream(emoji);
          window.setTimeout(() => setDaydream(null), 2800);
        } else if (roll < 0.85) {
          triggerMood("yawn", 2200);
        } else if (roll < 0.95) {
          triggerMood("sneeze", 1800);
        } else {
          triggerMood("sleepy", 3500);
        }

        scheduleRandomEvent();
      }, delay);
    };

    scheduleRandomEvent();
    return () => window.clearTimeout(eventTimerRef.current);
  }, [isAudioActive]);

  // Inactivity Sleep timer
  useEffect(() => {
    if (isAudioActive) return;
    let timer: number;
    const resetIdle = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        if (performance.now() >= moodLockedUntilRef.current) {
          triggerMood("sleepy", 3500);
        }
      }, 16000);
    };
    resetIdle();

    const onUserActive = () => {
      if (currentMoodRef.current === "sleepy" && performance.now() >= moodLockedUntilRef.current) {
        triggerMood("happy", 0, true);
      }
      resetIdle();
    };

    window.addEventListener("pointermove", onUserActive, { passive: true });
    window.addEventListener("keydown", onUserActive, { passive: true });
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("pointermove", onUserActive);
      window.removeEventListener("keydown", onUserActive);
    };
  }, [isAudioActive]);

  // 4. Tactile Pointer Interactions (Petting & Tickling with deliberate stroke detection)
  const onPointerMove = (e: React.PointerEvent<HTMLDivElement> | PointerEvent, rect?: DOMRect) => {
    // Musicwise: Block all tactile/cursor reactions so BMO stays uninterrupted in his groove
    if (isMusicPlaying) {
      return;
    }

    const now = performance.now();
    const prev = lastPointerRef.current;

    if (rect) {
      isDirectlyHoveredRef.current = true;
      // Local coordinate within companion bounding box (0 to 1)
      const relX = (e.clientX - rect.left) / rect.width;
      const relY = (e.clientY - rect.top) / rect.height;

      // Laser Pointer / Eye Tracking inside companion
      const dx = Math.max(-1, Math.min(1, (relX - 0.5) * 2.2));
      const dy = Math.max(-1, Math.min(1, (relY - 0.5) * 2.2));
      setLook({ x: dx, y: dy });

      // Track distance traveled and direction changes with noise filter
      const deltaX = e.clientX - prev.x;
      const deltaY = e.clientY - prev.y;
      const distStep = Math.hypot(deltaX, deltaY);

      if (Math.abs(deltaX) >= 2.5) {
        const sign = Math.sign(deltaX);
        if (prev.lastSign !== 0 && sign !== prev.lastSign) {
          prev.dirChanges += 1;
        }
        prev.lastSign = sign;
      }
      prev.totalDist = (prev.totalDist || 0) + distStep;

      // 5 deliberate direction changes and >= 48px travel distance
      const isStroking = prev.dirChanges >= 5 && prev.totalDist >= 48;

      if (isStroking && currentMoodRef.current !== "angry" && currentMoodRef.current !== "sad") {
        const strokeMood: CompanionMood = relY < 0.50 ? "petting" : "tickled";
        triggerMood(strokeMood, undefined, true);
        prev.dirChanges = 0;
        prev.totalDist = 0;
        prev.lastSign = 0;
      } else if (
        currentMoodRef.current !== "angry" &&
        currentMoodRef.current !== "sad" &&
        currentMoodRef.current !== "petting" &&
        currentMoodRef.current !== "tickled" &&
        !isAudioActive
      ) {
        triggerMood("curious");
      }
    }

    prev.x = e.clientX;
    prev.y = e.clientY;
    prev.time = now;
  };

  const onPointerLeave = () => {
    isDirectlyHoveredRef.current = false;
    // Musicwise: Keep face centered and do not interrupt vibe mood
    if (isMusicPlaying) {
      return;
    }
    setLook({ x: 0, y: 0 });
    lastPointerRef.current.dirChanges = 0;
    lastPointerRef.current.totalDist = 0;
    lastPointerRef.current.lastSign = 0;

    const now = performance.now();
    // If not locked in an active emotion, return smoothly to ambient state
    if (now >= moodLockedUntilRef.current) {
      const ambient = getAmbientMood();
      currentMoodRef.current = ambient;
      setMood(ambient);
    }
  };

  // 5. Click / Poke Interaction
  const onClick = (e?: React.MouseEvent) => {
    // Musicwise: Block poke, wink, and tantrum reactions so BMO stays uninterrupted in his groove
    if (isMusicPlaying) {
      return;
    }

    e?.stopPropagation();
    pokeCountRef.current += 1;
    const count = pokeCountRef.current;

    if (count >= 3) {
      // Rapid multi-poke tantrum!
      triggerMood("angry", 2400, true);
      window.setTimeout(() => {
        triggerMood("sad", 2000, true);
        window.setTimeout(() => {
          pokeCountRef.current = 0;
          triggerMood(getAmbientMood(), 0, true);
        }, 2000);
      }, 2400);
    } else {
      triggerMood("winking", 650, true);
      window.setTimeout(() => {
        if (pokeCountRef.current < 3) {
          triggerMood(getAmbientMood(), 0, true);
        }
      }, 650);
    }

    window.setTimeout(() => {
      pokeCountRef.current = Math.max(0, pokeCountRef.current - 1);
    }, 1800);
  };

  const dynamicAudioInfo: AudioClassification = {
    ...audioInfo,
    grooveLevel: liveGrooveLevel,
    statusHint:
      audioInfo.isPodcast
        ? audioInfo.statusHint
        : audioInfo.isLofiStudy
          ? audioInfo.statusHint
          : liveGrooveLevel === 3
            ? "SUPER GROOVE! ⚡"
            : liveGrooveLevel === 2
              ? "Jamming to the beat ♫"
              : "Swaying to the music ♪",
  };

  return {
    mood,
    look,
    blink,
    daydream,
    audioInfo: dynamicAudioInfo,
    onPointerMove,
    onPointerLeave,
    onClick,
  };
}
