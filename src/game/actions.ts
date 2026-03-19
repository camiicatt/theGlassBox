import type { Action } from "../app/store/useGameStore";

export const ACTIONS: Action[] = [
  "UP", "DOWN", "LEFT", "RIGHT",
  "WAIT",
  "HEAL", "HIDE", "RUN", "FIGHT",
];

export const BATTLE_ACTIONS: Action[] = ["FIGHT", "HIDE", "HEAL", "RUN"];
export const MOVE_ACTIONS: Action[] = ["UP", "DOWN", "LEFT", "RIGHT"];