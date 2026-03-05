import { useGameStore } from "./store/useGameStore";
import type { Action } from "./store/useGameStore";

const SURVIVAL_ACTIONS: Action[] = ["HEAL", "HIDE", "RUN", "FIGHT"];
const ADVANCED_ACTIONS: Action[] = ["UP", "DOWN", "LEFT", "RIGHT", "ATTACK", "WAIT"];

function tileChar(v: number) {
  if (v === 1) return "█"; // wall
  if (v === 2) return "E"; // enemy
  if (v === 3) return "G"; // goal
  return ".";
}

export default function ReviewModal() {
  const mode = useGameStore((s) => s.mode);
  const reviewMoments = useGameStore((s) => s.reviewMoments);
  const reviewIndex = useGameStore((s) => s.reviewIndex);

  const addExample = useGameStore((s) => s.addExample);
  const resetReview = useGameStore((s) => s.resetReview);
  const setMode = useGameStore((s) => s.setMode);

  const requestRestart = useGameStore((s) => (s as any).requestRestart);

  if (mode !== "REVIEW") return null;

  const moment = reviewMoments[reviewIndex];

  // Done reviewing
  if (!moment) {
    return (
      <div style={overlayStyle}>
        <div style={boxStyle}>
          <h2>Training Complete</h2>
          <p>You helped the AI learn from its mistakes.</p>

          <button
            onClick={() => {
              resetReview();
              requestRestart?.();
              setMode("AI_RUN");
            }}
          >
            Run AI Again
          </button>
        </div>
      </div>
    );
  }

  const isLast = reviewIndex >= reviewMoments.length - 1;

  const choose = (a: Action) => {
    addExample({ state: moment.state.slice(), action: a });
  
    // close review immediately
    resetReview();
    requestRestart?.();
    setMode("AI_RUN");
  };

  const rows: string[] = [];
  for (let r = 0; r < 5; r++) {
    rows.push(moment.state.slice(r * 5, r * 5 + 5).map(tileChar).join(" "));
  }

  return (
    <div style={overlayStyle}>
      <div style={boxStyle}>
        <h2>Help Train Your AI</h2>

        <p>AI confidence: {(moment.confidence * 100).toFixed(0)}%</p>

        <div style={gridStyle}>
          {rows.map((r, i) => (
            <div key={i}>{r}</div>
          ))}
        </div>

        <p style={{ marginTop: 10 }}>What should your hero do to survive?</p>

        {/* Main survival buttons */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 10 }}>
          {SURVIVAL_ACTIONS.map((a) => (
            <button
              key={a}
              style={{
                padding: "12px 12px",
                borderRadius: 14,
                border: "1px solid #1f2a44",
                background: a === "HEAL" ? "#133a25" : a === "FIGHT" ? "#2a1630" : "#0b1226",
                color: "white",
                fontWeight: 900,
                cursor: "pointer",
              }}
              onClick={() => choose(a)}
            >
              {a === "HEAL" ? "❤️ HEAL" : a === "HIDE" ? "🫥 HIDE" : a === "RUN" ? "💨 RUN" : "⚔ FIGHT"}
            </button>
          ))}
        </div>

        {/* Optional movement fixes */}
        <details style={{ marginTop: 12, opacity: 0.9 }}>
          <summary style={{ cursor: "pointer", fontWeight: 800 }}>Advanced: movement fixes</summary>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "center", marginTop: 10 }}>
            {ADVANCED_ACTIONS.map((a) => (
              <button
                key={a}
                onClick={() => choose(a)}
                style={{
                  padding: "8px 10px",
                  borderRadius: 12,
                  border: "1px solid #1f2a44",
                  background: "#0b1226",
                  color: "white",
                  fontWeight: 800,
                  cursor: "pointer",
                }}
              >
                {a}
              </button>
            ))}
          </div>
        </details>
      </div>
    </div>
  );
}

const overlayStyle: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  background: "rgba(0,0,0,0.6)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  zIndex: 100,
};

const boxStyle: React.CSSProperties = {
  width: 420,
  padding: 20,
  background: "#0b1020",
  color: "white",
  borderRadius: 12,
  textAlign: "center",
  border: "1px solid #1f2a44",
};

const gridStyle: React.CSSProperties = {
  fontFamily: "monospace",
  margin: "15px 0",
  fontSize: 20,
};