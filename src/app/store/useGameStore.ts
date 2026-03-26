import { create } from "zustand";
import type { RunStats } from "../../lib/supabaseLogger";

export type Mode = "BOOT" | "TRAINING" | "AI_RUN" | "REVIEW";

export type Action =
  | "UP"
  | "DOWN"
  | "LEFT"
  | "RIGHT"
  | "ATTACK"
  | "WAIT"
  | "FIGHT"
  | "HIDE"
  | "HEAL"
  | "RUN";

export type Example = {
  state: number[];
  action: Action;
};

export type Prediction = {
  probs: Record<Action, number>;
  confidence: number;
  bestAction: Action;
};

export type ReviewMoment = {
  id: string;
  state: number[];
  confidence: number;
  aiChose: Action;
};

export type EnemyKind = "slime" | "bigSlime" | "spider";

export type BattlePrompt = {
  enemyName: string;
  enemyKind: EnemyKind;
  enemySprite: string;
  heroSprite: string;
  enemyHp: number;
  enemyMaxHp: number;
  heroHp: number;
  heroMaxHp: number;

  lastAction?: "FIGHT" | "HIDE" | "HEAL" | "RUN" | null;
  heroHit?: boolean;
  enemyHit?: boolean;
  heroDead?: boolean;
  enemyDead?: boolean;

  aiMode?: boolean;
  aiThinking?: boolean;
  aiChosenAction?: Action | null;
  aiConfidence?: number;
  aiProbs?: Partial<Record<Action, number>>;
};

type GameStore = {
  mode: Mode;
  setMode: (m: Mode) => void;

  studentId: string | null;
  setStudentId: (id: string | null) => void;

  supabaseSessionId: number | null;
  setSupabaseSessionId: (id: number | null) => void;

  sessionStartTime: number | null;
  setSessionStartTime: (t: number | null) => void;

  supabaseRunId: number | null;
  setSupabaseRunId: (id: number | null) => void;

  runStartTime: number | null;
  setRunStartTime: (t: number | null) => void;

  supabasePlayerStatsId: number | null;
  setSupabasePlayerStatsId: (id: number | null) => void;

  supabaseAiStatsId: number | null;
  setSupabaseAiStatsId: (id: number | null) => void;

  supabaseDungeonId: number | null;
  setSupabaseDungeonId: (id: number | null) => void;

  playerRunStats: RunStats;
  incrementPlayerStat: (key: keyof RunStats) => void;
  resetPlayerRunStats: () => void;

  aiRunStats: RunStats;
  incrementAiStat: (key: keyof RunStats) => void;
  resetAiRunStats: () => void;

  restartToken: number;
  requestRestart: () => void;

  resetForNewStudent: () => void;

  saveToLocal: () => void;
  loadFromLocal: (id: string | null) => void;
  clearLocalFor: (id: string) => void;

  heroDead: boolean;
  setHeroDead: (v: boolean) => void;

  currentState: number[] | null;
  setCurrentState: (s: number[]) => void;

  examples: Example[];
  addExample: (ex: Example) => void;
  clearExamples: () => void;

  prediction: Prediction | null;
  setPrediction: (p: Prediction | null) => void;

  reviewMoments: ReviewMoment[];
  setReviewMoments: (m: ReviewMoment[]) => void;

  reviewIndex: number;
  nextReview: () => void;
  resetReview: () => void;

  runDungeonIndex: number;
  setRunDungeonIndex: (i: number) => void;

  lowConfThreshold: number;
  setLowConfThreshold: (v: number) => void;

  battlePrompt: BattlePrompt | null;
  openBattlePrompt: (p: BattlePrompt) => void;
  closeBattlePrompt: () => void;

  battleLog: string;
  setBattleLog: (msg: string) => void;

  pendingAction: Action | null;
  setPendingAction: (a: Action | null) => void;
};

export const useGameStore = create<GameStore>((set, get) => ({
  mode: "BOOT",
  setMode: (m) => set({ mode: m }),

  studentId: null,
  setStudentId: (id) => set({ studentId: id }),

  supabaseSessionId: null,
  setSupabaseSessionId: (id) => set({ supabaseSessionId: id }),

  sessionStartTime: null,
  setSessionStartTime: (t) => set({ sessionStartTime: t }),

  supabaseRunId: null,
  setSupabaseRunId: (id) => set({ supabaseRunId: id }),

  runStartTime: null,
  setRunStartTime: (t) => set({ runStartTime: t }),

  playerRunStats: { numActions: 0, numDungeons: 0, numFight: 0, numHide: 0, numHeal: 0, numRun: 0 },
  incrementPlayerStat: (key) =>
    set((s) => ({ playerRunStats: { ...s.playerRunStats, [key]: s.playerRunStats[key] + 1 } })),
  resetPlayerRunStats: () =>
    set({ playerRunStats: { numActions: 0, numDungeons: 0, numFight: 0, numHide: 0, numHeal: 0, numRun: 0 } }),

  aiRunStats: { numActions: 0, numDungeons: 0, numFight: 0, numHide: 0, numHeal: 0, numRun: 0 },
  incrementAiStat: (key) =>
    set((s) => ({ aiRunStats: { ...s.aiRunStats, [key]: s.aiRunStats[key] + 1 } })),
  resetAiRunStats: () =>
    set({ aiRunStats: { numActions: 0, numDungeons: 0, numFight: 0, numHide: 0, numHeal: 0, numRun: 0 } }),

  supabasePlayerStatsId: null,
  setSupabasePlayerStatsId: (id) => set({ supabasePlayerStatsId: id }),

  supabaseAiStatsId: null,
  setSupabaseAiStatsId: (id) => set({ supabaseAiStatsId: id }),

  supabaseDungeonId: null,
  setSupabaseDungeonId: (id) => set({ supabaseDungeonId: id }),

  restartToken: 0,
  requestRestart: () => set((s) => ({ restartToken: s.restartToken + 1 })),

  heroDead: false,
  setHeroDead: (v) => set({ heroDead: v }),

  currentState: null,
  setCurrentState: (s) => set({ currentState: s }),

  examples: [],
  addExample: (ex) => set((state) => ({ examples: [...state.examples, ex] })),
  clearExamples: () => set({ examples: [] }),

  prediction: null,
  setPrediction: (p) => set({ prediction: p }),

  reviewMoments: [],
  setReviewMoments: (m) => set({ reviewMoments: m }),

  reviewIndex: 0,
  nextReview: () =>
    set((state) => ({
      reviewIndex: Math.min(state.reviewIndex + 1, state.reviewMoments.length),
    })),
  resetReview: () => set({ reviewIndex: 0, reviewMoments: [] }),

  runDungeonIndex: 0,
  setRunDungeonIndex: (i) => set({ runDungeonIndex: i }),

  lowConfThreshold: 0.55,
  setLowConfThreshold: (v) => set({ lowConfThreshold: v }),

  battlePrompt: null,
  openBattlePrompt: (p) => set({ battlePrompt: p }),
  closeBattlePrompt: () => set({ battlePrompt: null }),

  battleLog: "",
  setBattleLog: (msg) => set({ battleLog: msg }),

  pendingAction: null,
  setPendingAction: (a) => set({ pendingAction: a }),

  resetForNewStudent: () =>
    set({
      mode: "BOOT",
      currentState: null,
      examples: [],
      prediction: null,
      reviewMoments: [],
      reviewIndex: 0,
      runDungeonIndex: 0,
      lowConfThreshold: 0.55,
      battlePrompt: null,
      battleLog: "",
      pendingAction: null,
      heroDead: false,
      supabaseSessionId: null,
      sessionStartTime: null,
      supabaseRunId: null,
      runStartTime: null,
      supabasePlayerStatsId: null,
      supabaseAiStatsId: null,
      supabaseDungeonId: null,
      playerRunStats: { numActions: 0, numDungeons: 0, numFight: 0, numHide: 0, numHeal: 0, numRun: 0 },
      aiRunStats: { numActions: 0, numDungeons: 0, numFight: 0, numHide: 0, numHeal: 0, numRun: 0 },
    }),

  saveToLocal: () => {
    const st = get();
    if (!st.studentId) return;

    const payload = {
      studentId: st.studentId,
      examples: st.examples,
      lowConfThreshold: st.lowConfThreshold,
    };

    localStorage.setItem(`dungeon-ai:${st.studentId}`, JSON.stringify(payload));
  },

  loadFromLocal: (id) => {
    if (!id) return;

    const raw = localStorage.getItem(`dungeon-ai:${id}`);
    if (!raw) return;

    const data = JSON.parse(raw);

    set({
      studentId: data.studentId ?? id,
      examples: data.examples ?? [],
      lowConfThreshold: data.lowConfThreshold ?? 0.55,
      mode: "TRAINING",
      prediction: null,
      reviewMoments: [],
      reviewIndex: 0,
      battlePrompt: null,
      battleLog: "",
      pendingAction: null,
      heroDead: false,
    });
  },

  clearLocalFor: (id) => {
    localStorage.removeItem(`dungeon-ai:${id}`);
  },
}));