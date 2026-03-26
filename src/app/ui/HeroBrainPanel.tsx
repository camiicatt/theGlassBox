import React from "react";
import { useGameStore } from "../store/useGameStore";
import type { Action, Mode } from "../store/useGameStore";
import { closeSession } from "../../lib/supabaseLogger";

const SURVIVAL_ACTIONS: Action[] = ["HEAL", "HIDE", "RUN", "FIGHT"];
const MOVE_ACTIONS: Action[] = ["UP", "DOWN", "LEFT", "RIGHT"];

function clamp01(value: number) {
  return Math.max(0, Math.min(1, value));
}

function confidenceWord(value: number) {
  if (value >= 0.8) return "High";
  if (value >= 0.6) return "Good";
  if (value >= 0.4) return "Okay";
  if (value >= 0.2) return "Low";
  return "Tiny";
}

function confidenceColor(value: number) {
  if (value >= 0.8) return "#22c55e";
  if (value >= 0.6) return "#84cc16";
  if (value >= 0.4) return "#eab308";
  if (value >= 0.2) return "#f97316";
  return "#ef4444";
}

function actionLabel(action: Action) {
  switch (action) {
    case "UP":
      return "Up";
    case "DOWN":
      return "Down";
    case "LEFT":
      return "Left";
    case "RIGHT":
      return "Left";
    case "HEAL":
      return "Heal";
    case "HIDE":
      return "Hide";
    case "RUN":
      return "Run";
    case "FIGHT":
      return "Fight";
    default:
      return action;
  }
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

function BarRow({
  label,
  value,
}: {
  label: string;
  value: number;
}) {
  const safe = clamp01(value);
  const color = confidenceColor(safe);
  const word = confidenceWord(safe);

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "56px 1fr 44px",
        alignItems: "center",
        gap: 8,
        marginBottom: 8,
      }}
    >
      <div
        style={{
          fontSize: 12,
          fontWeight: 700,
          color: "#e5e7eb",
          textTransform: "uppercase",
        }}
      >
        {label}
      </div>

      <div
        style={{
          height: 12,
          background: "#0f172a",
          border: "1px solid #22304a",
          borderRadius: 999,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            width: `${safe * 100}%`,
            height: "100%",
            background: color,
            borderRadius: 999,
            transition: "width 160ms ease",
          }}
        />
      </div>

      <div
        style={{
          fontSize: 11,
          fontWeight: 700,
          color,
          textAlign: "right",
        }}
      >
        {word}
      </div>
    </div>
  );
}

export default function HeroBrainPanel() {
  const mode = useGameStore((s) => s.mode);
  const prediction = useGameStore((s) => s.prediction);
  const examples = useGameStore((s) => s.examples);
  const setMode = useGameStore((s) => s.setMode);
  const clearExamples = useGameStore((s) => s.clearExamples);
  const studentId = useGameStore((s) => s.studentId);
  const prompt = useGameStore((s) => s.battlePrompt);
  const setPendingAction = useGameStore((s) => s.setPendingAction);
  const supabaseSessionId = useGameStore((s) => s.supabaseSessionId);
  const sessionStartTime = useGameStore((s) => s.sessionStartTime);
  const resetForNewStudent = useGameStore((s) => s.resetForNewStudent);

  const probs: Partial<Record<Action, number>> = prediction?.probs ?? {};
  const overallConfidence = clamp01(prediction?.confidence ?? 0);
  
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
  
  const sortedMoves = MOVE_ACTIONS
    .map((action) => ({
      action,
      value: clamp01(probs[action] ?? 0),
    }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 3);

  const showTrainingButtons = mode === "TRAINING" && !prompt;

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

      <div style={{ display: "flex", gap: 8, marginTop: 12, marginBottom: 12 }}>
        <button
          style={mode === "TRAINING" ? activeTabStyle : tabStyle}
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
        <button
          style={mode === "REVIEW" ? activeTabStyle : tabStyle}
          onClick={() => setMode("REVIEW")}
        >
          Review
        </button>
      </div>

      <div style={{ marginBottom: 8, fontSize: 13, fontWeight: 700 }}>Confidence</div>
      <BarRow label="AI" value={overallConfidence} />

      <div
        style={{
          fontSize: 12,
          color: confidenceColor(overallConfidence),
          fontWeight: 700,
          marginBottom: 10,
        }}
      >
        {overallConfidence >= 0.6
          ? "Confident"
          : overallConfidence >= 0.3
          ? "Unsure"
          : "Confused"}
      </div>

      <div
        style={{
          fontSize: 12,
          color: "#94a3b8",
          lineHeight: 1.5,
          marginBottom: 16,
        }}
      >
        What you demonstrate becomes what the robot trusts.
      </div>

      <div style={sectionTitleStyle}>What you taught</div>
      <div style={{ marginBottom: 16 }}>
        {survivalBars.map((item) => (
          <BarRow
            key={item.action}
            label={actionLabel(item.action)}
            value={item.value}
          />
        ))}
      </div>

      {showTrainingButtons && (
        <>
          <div style={sectionTitleStyle}>Teach outside combat</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 16 }}>
            <button style={buttonStyle} onClick={() => setPendingAction("HEAL")}>
              ❤️ Teach Heal
            </button>
            <button style={buttonStyle} onClick={() => setPendingAction("HIDE")}>
              🥸 Teach Hide
            </button>
          </div>
        </>
      )}

      <div style={sectionTitleStyle}>You taught</div>
      <div style={{ fontSize: 13, color: "#e5e7eb", lineHeight: 1.7, marginBottom: 16 }}>
        <div>❤️ HEAL <span style={countStyle}>{examples.filter((e) => e.action === "HEAL").length}</span></div>
        <div>🥸 HIDE <span style={countStyle}>{examples.filter((e) => e.action === "HIDE").length}</span></div>
        <div>💨 RUN <span style={countStyle}>{examples.filter((e) => e.action === "RUN").length}</span></div>
        <div>⚔️ FIGHT <span style={countStyle}>{examples.filter((e) => e.action === "FIGHT").length}</span></div>
      </div>

      <div style={{ fontSize: 12, color: "#94a3b8", marginBottom: 16 }}>
        If HEAL or HIDE stay low, demonstrate them more often in the right situations.
      </div>

      <div style={sectionTitleStyle}>AI thinks right now: </div>
      <div style={{ marginBottom: 16 }}>
        {sortedMoves.map((item) => (
          <BarRow
            key={item.action}
            label={actionLabel(item.action)}
            value={item.value}
          />
        ))}
      </div>

      <div style={sectionTitleStyle}>Training data</div>
      <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 10 }}>
        {examples.length} examples
      </div>

      <button style={buttonStyle} onClick={() => clearExamples()}>
        🧹 Clear Examples
      </button>

      <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 12 }}>
        Tip: click the dungeon canvas so WASD controls work.
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

const countStyle: React.CSSProperties = {
  float: "right",
  color: "#cbd5e1",
  fontWeight: 700,
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