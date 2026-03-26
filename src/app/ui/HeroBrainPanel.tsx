import React from "react";
import { useGameStore } from "../store/useGameStore";
import type { Action, Mode } from "../store/useGameStore";
import { closeSession } from "../../lib/supabaseLogger";

const SURVIVAL_ACTIONS: Action[] = ["HEAL", "HIDE", "RUN", "FIGHT"];



function confidenceColor(value: number) {
  if (value >= 0.8) return "#22c55e";
  if (value >= 0.6) return "#84cc16";
  if (value >= 0.4) return "#eab308";
  if (value >= 0.2) return "#f97316";
  return "#ef4444";
}


function modeLabel(mode: Mode) {
  switch (mode) {
    case "BOOT":
      return "Boot Mode";
    case "TRAINING":
      return "Training Mode";
    case "AI_RUN":
      return "Autonomous Mode";
    case "REVIEW":
      return "Recovery Mode";
    default:
      return mode;
  }
}


export default function HeroBrainPanel() {
  const mode = useGameStore((s) => s.mode);
  const examples = useGameStore((s) => s.examples);
  const dungeonTimeLeft = useGameStore((s) => s.dungeonTimeLeft);
  const score = useGameStore((s) => s.score);
  const setMode = useGameStore((s) => s.setMode);
  const supabaseSessionId = useGameStore((s) => s.supabaseSessionId);
  const sessionStartTime = useGameStore((s) => s.sessionStartTime);
  const resetForNewStudent = useGameStore((s) => s.resetForNewStudent);

  const survivalCounts: Record<Action, number> = {
    UP: 0,
    DOWN: 0,
    LEFT: 0,
    RIGHT: 0,
    ATTACK: 0,
    WAIT: 0,
    FIGHT: 0,
    HIDE: 0,
    HEAL: 0,
    RUN: 0,
  };
  
  for (const ex of examples) {
    survivalCounts[ex.action] = (survivalCounts[ex.action] ?? 0) + 1;
  }
  
  const totalSurvivalExamples =
    survivalCounts["HEAL"] +
    survivalCounts["HIDE"] +
    survivalCounts["RUN"] +
    survivalCounts["FIGHT"];
  
  const survivalBars = SURVIVAL_ACTIONS.map((action) => ({
    action,
    value:
      totalSurvivalExamples > 0
        ? survivalCounts[action] / totalSurvivalExamples
        : 0,
  }));
  

  return (
    <aside
      style={{
        width: 320,
        minWidth: 320,
        background: "#020817",
        color: "#f8fafc",
        border: "1px solid #1e293b",
        borderRadius: 18,
        padding: 16,
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 12,
        }}
      >
        <div style={{ fontSize: 16, fontWeight: 800, letterSpacing: 0.3 }}>
          HERO BRAIN
        </div>
        <div style={{ fontSize: 12, color: "#cbd5e1" }}>
          Mode: {modeLabel(mode)}
        </div>
      </div>

      {mode === "TRAINING" && (
        <div style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          background: dungeonTimeLeft <= 10 ? "#7f1d1d" : "#0f172a",
          border: `1px solid ${dungeonTimeLeft <= 10 ? "#ef4444" : "#22304a"}`,
          borderRadius: 8,
          padding: "8px 12px",
          marginBottom: 16,
        }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: "#94a3b8" }}>⏱ Time Left</span>
          <span style={{ fontSize: 22, fontWeight: 900, color: dungeonTimeLeft <= 10 ? "#ef4444" : "#f8fafc" }}>
            {dungeonTimeLeft}s
          </span>
        </div>
      )}

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "#0f172a", border: "1px solid #22304a", borderRadius: 8, padding: "8px 12px", marginBottom: 16 }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: "#94a3b8" }}>⭐ Score</span>
        <span style={{ fontSize: 22, fontWeight: 900, color: "#f8fafc" }}>{score}</span>
      </div>

      <div style={sectionTitleStyle}>What you taught</div>
      <div style={{ marginBottom: 16 }}>
        {[
          { action: "HEAL" as Action, emoji: "❤️" },
          { action: "HIDE" as Action, emoji: "🥸" },
          { action: "RUN" as Action, emoji: "💨" },
          { action: "FIGHT" as Action, emoji: "⚔️" },
        ].map(({ action, emoji }) => {
          const count = examples.filter((e) => e.action === action).length;
          const bar = survivalBars.find((b) => b.action === action);
          return (
            <div key={action} style={{ marginBottom: 10 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: "#e5e7eb" }}>{emoji} {action}</span>
                <span style={{ fontSize: 12, fontWeight: 700, color: "#cbd5e1" }}>{count}x</span>
              </div>
              <div style={{ height: 10, background: "#0f172a", border: "1px solid #22304a", borderRadius: 999, overflow: "hidden" }}>
                <div style={{ width: `${(bar?.value ?? 0) * 100}%`, height: "100%", background: confidenceColor(bar?.value ?? 0), borderRadius: 999, transition: "width 160ms ease" }} />
              </div>
              <div style={{ fontSize: 11, fontWeight: 700, color: confidenceColor(bar?.value ?? 0), marginTop: 3 }}>
                {bar?.value ?? 0 >= 0.6 ? "Confident" : bar?.value ?? 0 >= 0.3 ? "Unsure" : "Needs more examples"}
              </div>
            </div>
          );
        })}
      </div>

      <div style={{ fontSize: 12, color: "#94a3b8", marginBottom: 16 }}>
        If HEAL or HIDE stay low, demonstrate them more often in the right situations.
      </div>

      <div style={sectionTitleStyle}>Training data</div>
      <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 10 }}>
        {examples.length} examples
      </div>

      <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 12 }}>
        Tip: click the dungeon canvas so WASD controls work.
      </div>

      <div style={{ marginTop: "auto", paddingTop: 16, display: "flex", flexDirection: "column", gap: 8 }}>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            style={mode === "TRAINING" ? activeTrainingTabStyle : trainingTabStyle}
            onClick={() => setMode("TRAINING")}
          >
            Training
          </button>
          <button
            style={mode === "AI_RUN" ? activeTabStyle : tabStyle}
            onClick={() => setMode("AI_RUN")}
          >
            Run AI
          </button>
        </div>
        <button
          style={buttonStyle}
          onClick={async () => {
            if (supabaseSessionId !== null && sessionStartTime !== null) {
              await closeSession(supabaseSessionId, sessionStartTime, 0, 0);
            }
            resetForNewStudent();
          }}
        >
          Switch Student
        </button>
      </div>
    </aside>
  );
}

const sectionTitleStyle: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 800,
  marginBottom: 8,
  color: "#f8fafc",
};

const tabStyle: React.CSSProperties = {
  background: "#e5e7eb",
  color: "#111827",
  border: "none",
  borderRadius: 4,
  padding: "6px 10px",
  fontWeight: 700,
  cursor: "pointer",
};

const activeTabStyle: React.CSSProperties = {
  ...tabStyle,
  background: "#ffffff",
  boxShadow: "0 0 0 2px #475569 inset",
};

const trainingTabStyle: React.CSSProperties = {
  ...tabStyle,
  padding: "9px 16px",
  fontSize: 14,
};

const activeTrainingTabStyle: React.CSSProperties = {
  ...trainingTabStyle,
  background: "#ffffff",
  boxShadow: "0 0 0 2px #475569 inset",
};

const buttonStyle: React.CSSProperties = {
  width: "100%",
  background: "#e5e7eb",
  color: "#111827",
  border: "none",
  borderRadius: 4,
  padding: "6px 10px",
  fontWeight: 700,
  cursor: "pointer",
};