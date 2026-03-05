import { useGameStore } from "./store/useGameStore";
import type { Action } from "./store/useGameStore";

export default function OptionBoard() {
  const mode = useGameStore(s => s.mode);
  const prompt = useGameStore(s => s.battlePrompt);
  const close = useGameStore(s => s.closeBattlePrompt);

  const overlay: React.CSSProperties = {
    position: "absolute",
    left: 16,
    top: 90,
    zIndex: 200,
    pointerEvents: "none",
    display: "flex",
  };

  // We'll use this to send the chosen action to Phaser via a store "queue"
  const setPendingAction = useGameStore(s => s.setPendingAction);

  if (!prompt || mode !== "TRAINING") return null;

  const choose = (a: Action) => {
    setPendingAction(a);
    // do NOT close here 
  };

  return (
    <div style={overlay}>
      <div style={card}>
        <div style={{display:"flex", justifyContent:"space-between", alignItems:"center"}}>
          <div>
            <div style={{fontSize:18, fontWeight:900}}>A wild {prompt.enemyName}!</div>
            <div style={{fontSize:12, opacity:0.8}}>Pick an action:</div>
          </div>
          <div style={{fontSize:12, opacity:0.8}}>Enemy HP: {prompt.enemyHp}</div>
        </div>

        <div style={{display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginTop:14}}>
          <button style={btnPrimary} onClick={() => choose("FIGHT")}>⚔ Fight</button>
          <button style={btn} onClick={() => choose("HIDE")}>🫥 Hide</button>
          <button style={btn} onClick={() => choose("HEAL")}>❤️ Heal</button>
          <button style={btn} onClick={() => choose("RUN")}>💨 Run</button>
        </div>

        <div style={{marginTop:12, fontSize:12, opacity:0.75}}>
          This choice becomes a training example for the AI.
        </div>
      </div>
    </div>
  );
}

const overlay: React.CSSProperties = {
  position: "fixed",
  right: 18,
  top: 90,
  background: "transparent",
  display: "flex",
  alignItems: "flex-start",
  justifyContent: "flex-end",
  zIndex: 200,
  pointerEvents: "none", 
};

const card: React.CSSProperties = {
  width: 360,
  padding: 16,
  borderRadius: 16,
  background: "linear-gradient(135deg, #0b1020, #111a33)",
  border: "1px solid #1f2a44",
  color: "#e5e7eb",
  pointerEvents: "auto" 
};


const btn: React.CSSProperties = {
  padding: "12px 12px", borderRadius: 14, border: "1px solid #1f2a44",
  background: "#0b1226", color: "#e5e7eb", fontWeight: 800, cursor: "pointer"
};
const btnPrimary: React.CSSProperties = {
  ...btn,
  border: "1px solid #2b3c66",
  background: "linear-gradient(135deg, #2563eb, #1d4ed8)",
  color: "white"
};