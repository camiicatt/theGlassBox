import { useGameStore } from "./store/useGameStore";
import type { Action } from "./store/useGameStore";

export default function OptionBoard() {
  const mode = useGameStore((s) => s.mode);
  const prompt = useGameStore((s) => s.battlePrompt);
  const battleLog = useGameStore((s) => s.battleLog);

  // We'll use this to send the chosen action to Phaser via a store "queue"
  const setPendingAction = useGameStore((s) => s.setPendingAction);

  if (!prompt || mode !== "TRAINING") return null;

  const choose = (a: Action) => {
    setPendingAction(a);
    // do NOT close here 
  };

  return (
    <div style={overlay}>
      <div style={card}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ fontSize: 30, fontWeight: 900 }}>Battle: {prompt.enemyName}</div>
            <div style={{ fontSize: 15, opacity: 0.9 }}>You collided with an enemy. Pick an action:</div>
          </div>
          <div style={{ fontSize: 16, opacity: 0.95 }}>Enemy HP: {prompt.enemyHp}/{prompt.enemyMaxHp}</div>
        </div>

        <div style={healthGrid}>
          <div style={healthPanel}>
            <div style={healthLabel}>Your Health</div>
            <div style={healthValue}>{prompt.heroHp}/{prompt.heroMaxHp}</div>
            <div style={barTrack}>
              <div
                style={{
                  ...barFillHero,
                  width: `${Math.round((prompt.heroHp / Math.max(1, prompt.heroMaxHp)) * 100)}%`,
                }}
              />
            </div>
          </div>
          <div style={healthPanel}>
            <div style={healthLabel}>{prompt.enemyName} Health</div>
            <div style={healthValue}>{prompt.enemyHp}/{prompt.enemyMaxHp}</div>
            <div style={barTrack}>
              <div
                style={{
                  ...barFillEnemy,
                  width: `${Math.round((prompt.enemyHp / Math.max(1, prompt.enemyMaxHp)) * 100)}%`,
                }}
              />
            </div>
          </div>
        </div>

        <div style={enemyActionBox}>
          <div style={{ fontSize: 12, opacity: 0.75, textTransform: "uppercase", letterSpacing: 0.4 }}>
            Battle Feed
          </div>
          <div style={{ marginTop: 6, fontSize: 18, fontWeight: 700, minHeight: 24 }}>
            {battleLog || "Choose an action to begin."}
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 16 }}>
          <button style={btnPrimary} onClick={() => choose("FIGHT")}>Fight</button>
          <button style={btn} onClick={() => choose("HIDE")}>Hide</button>
          <button style={btn} onClick={() => choose("HEAL")}>Heal</button>
          <button style={btn} onClick={() => choose("RUN")}>Run</button>
        </div>

        <div style={{ marginTop: 12, fontSize: 12, opacity: 0.75 }}>
          This choice becomes a training example for the AI.
        </div>
      </div>
    </div>
  );
}

const overlay: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  background: "linear-gradient(180deg, #020617 0%, #0b1020 55%, #111827 100%)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  zIndex: 220,
  pointerEvents: "auto",
};

const card: React.CSSProperties = {
  width: 640,
  maxWidth: "calc(100vw - 32px)",
  padding: 28,
  borderRadius: 20,
  background: "linear-gradient(135deg, #0b1020, #111a33)",
  border: "1px solid #1f2a44",
  color: "#e5e7eb",
  boxShadow: "0 20px 60px rgba(0,0,0,0.5)",
  pointerEvents: "auto",
};

const enemyActionBox: React.CSSProperties = {
  marginTop: 14,
  padding: "12px 14px",
  borderRadius: 14,
  border: "1px solid #334155",
  background: "rgba(15, 23, 42, 0.85)",
};

const healthGrid: React.CSSProperties = {
  marginTop: 14,
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: 10,
};

const healthPanel: React.CSSProperties = {
  padding: 12,
  borderRadius: 12,
  border: "1px solid #334155",
  background: "rgba(15, 23, 42, 0.65)",
};

const healthLabel: React.CSSProperties = {
  fontSize: 12,
  opacity: 0.8,
};

const healthValue: React.CSSProperties = {
  marginTop: 4,
  fontSize: 18,
  fontWeight: 800,
};

const barTrack: React.CSSProperties = {
  marginTop: 8,
  height: 8,
  borderRadius: 999,
  overflow: "hidden",
  background: "#1e293b",
};

const barFillHero: React.CSSProperties = {
  height: "100%",
  background: "linear-gradient(90deg, #22c55e, #16a34a)",
};

const barFillEnemy: React.CSSProperties = {
  height: "100%",
  background: "linear-gradient(90deg, #ef4444, #dc2626)",
};


const btn: React.CSSProperties = {
  padding: "14px 12px",
  borderRadius: 14,
  border: "1px solid #1f2a44",
  background: "#0b1226",
  color: "#e5e7eb",
  fontWeight: 800,
  fontSize: 17,
  cursor: "pointer",
};
const btnPrimary: React.CSSProperties = {
  ...btn,
  border: "1px solid #2b3c66",
  background: "linear-gradient(135deg, #2563eb, #1d4ed8)",
  color: "white"
};
