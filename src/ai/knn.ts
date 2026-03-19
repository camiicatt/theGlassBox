import type { Action, Example, Prediction } from "../app/store/useGameStore";
import { ACTIONS } from "../game/actions";

function euclidean(a: number[], b: number[]) {
  let s = 0;
  const n = Math.max(a.length, b.length);
  for (let i = 0; i < n; i++) {
    const d = (a[i] ?? 0) - (b[i] ?? 0);
    s += d * d;
  }
  return Math.sqrt(s);
}

function makeZeroProbs(): Record<Action, number> {
  const probs = {} as Record<Action, number>;
  for (const a of ACTIONS) probs[a] = 0;
  return probs;
}

function normalizeProbs(probs: Record<Action, number>) {
  let total = 0;
  for (const a of ACTIONS) total += probs[a] ?? 0;

  if (total <= 0) return probs;

  for (const a of ACTIONS) {
    probs[a] = (probs[a] ?? 0) / total;
  }
  return probs;
}

export function knnPredict(state: number[], examples: Example[], k = 7): Prediction {
  const probs = makeZeroProbs();

  if (examples.length === 0) {
    return { probs, confidence: 0, bestAction: "WAIT" };
  }

  const scored = examples
    .map((ex) => ({ ex, dist: euclidean(state, ex.state) }))
    .sort((a, b) => a.dist - b.dist)
    .slice(0, Math.min(k, examples.length));

  const eps = 1e-6;
  let total = 0;

  for (const s of scored) {
    const w = 1 / (s.dist + eps);
    const boosted = s.dist < 0.5 ? w * 1.25 : w;

    probs[s.ex.action] = (probs[s.ex.action] ?? 0) + boosted;
    total += boosted;
  }

  if (total > 0) {
    for (const a of ACTIONS) {
      probs[a] = probs[a] / total;
    }
  }

  let best: Action = "WAIT";
  let bestP = -1;

  for (const a of ACTIONS) {
    if (probs[a] > bestP) {
      bestP = probs[a];
      best = a;
    }
  }

  return {
    probs,
    confidence: Math.max(0, Math.min(1, bestP)),
    bestAction: best,
  };
}