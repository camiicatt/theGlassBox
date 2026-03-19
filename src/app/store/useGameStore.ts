import { create } from "zustand";

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

type GameStore = {
  mode: Mode;
  setMode: (m: Mode) => void;

  studentId: string | null;
  setStudentId: (id: string | null) => void;

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

  battlePrompt: null | {
    enemyName: string;
    enemyKind: "slime" | "bigSlime" | "spider";
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
  };
  
  openBattlePrompt: (p: {
    enemyName: string;
    enemyKind: "slime" | "bigSlime" | "spider";
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
  }) => void;

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

  restartToken: 0,
  requestRestart: () => set((s) => ({ restartToken: s.restartToken + 1 })),

  heroDead: false,
  setHeroDead: (v) => set({ heroDead: v }),

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
}));