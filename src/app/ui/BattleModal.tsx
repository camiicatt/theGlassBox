import { useGameStore } from "../store/useGameStore";
import type { Action } from "../store/useGameStore";

function spriteUrl(key?: string) {

  const base = import.meta.env.BASE_URL;

  switch (key) {
    case "slime":
      return `${base}assets/monsters/slimeGreen.png`;
    case "big-slime":
      return `${base}assets/monsters/big-slime.png`;
    case "spider-blue":
      return `${base}assets/monsters/spiderBlue.png`;
    case "hero":
    default:
      return `${base}assets/hero.png`;
  }
}

export default function OptionBoard() {
  const mode = useGameStore((s) => s.mode);
  const prompt = useGameStore((s) => s.battlePrompt);
  const battleLog = useGameStore((s) => s.battleLog);
  const setPendingAction = useGameStore((s) => s.setPendingAction);

  if (!prompt || mode !== "TRAINING") return null;

  const choose = (a: Action) => {
    setPendingAction(a);
  };

  const heroHpPct = Math.round((prompt.heroHp / Math.max(1, prompt.heroMaxHp)) * 100);
  const enemyHpPct = Math.round((prompt.enemyHp / Math.max(1, prompt.enemyMaxHp)) * 100);

  const heroClass = [
    "battleSprite",
    prompt.lastAction === "FIGHT" ? "heroAttack" : "",
    prompt.heroHit ? "gotHit" : "",
    prompt.heroDead ? "deadRed" : "",
  ]
    .filter(Boolean)
    .join(" ");

  const enemyClass = [
    "battleSprite",
    prompt.enemyHit ? "gotHit" : "",
    prompt.enemyDead ? "deadRed" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div style={overlay}>
      <div style={card}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ fontSize: 30, fontWeight: 900 }}>Battle: {prompt.enemyName}</div>
            <div style={{ fontSize: 15, opacity: 0.9 }}>Pick an action:</div>
          </div>
          <div style={{ fontSize: 16, opacity: 0.95 }}>
            Enemy HP: {prompt.enemyHp}/{prompt.enemyMaxHp}
          </div>
        </div>

        <div style={arena}>
          <div style={fighterCol}>
            <div style={fighterName}>Hero</div>
            <img
              src={spriteUrl(prompt.heroSprite)}
              alt="Hero"
              className={heroClass}
              style={spriteStyle}
            />
            <div style={barTrack}>
              <div
                style={{
                  ...barFillHero,
                  width: `${heroHpPct}%`,
                }}
              />
            </div>
          </div>

          <div style={vsText}>VS</div>

          <div style={fighterCol}>
            <div style={fighterName}>{prompt.enemyName}</div>
            <img
              src={spriteUrl(prompt.enemySprite)}
              alt={prompt.enemyName}
              className={enemyClass}
              style={spriteStyle}
            />
            <div style={barTrack}>
              <div
                style={{
                  ...barFillEnemy,
                  width: `${enemyHpPct}%`,
                  background: prompt.enemyDead
                    ? "linear-gradient(90deg, #f87171, #dc2626)"
                    : "linear-gradient(90deg, #ef4444, #dc2626)",
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

      <style>{`
        .battleSprite {
          width: 120px;
          height: 120px;
          object-fit: contain;
          image-rendering: pixelated;
          transition: transform 160ms ease, filter 160ms ease, opacity 160ms ease;
        }

        .heroAttack {
          animation: heroAttackAnim 180ms ease;
        }

        .gotHit {
          animation: gotHitAnim 180ms ease;
        }

        .deadRed {
          filter: sepia(1) saturate(5) hue-rotate(-20deg) brightness(0.9);
          opacity: 0.9;
        }

        @keyframes heroAttackAnim {
          0% { transform: translateX(0); }
          50% { transform: translateX(28px) scale(1.06); }
          100% { transform: translateX(0); }
        }

        @keyframes gotHitAnim {
          0% { transform: translateX(0); }
          20% { transform: translateX(-8px); }
          40% { transform: translateX(8px); }
          60% { transform: translateX(-6px); }
          80% { transform: translateX(6px); }
          100% { transform: translateX(0); }
        }
      `}</style>
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
  width: 720,
  maxWidth: "calc(100vw - 32px)",
  padding: 28,
  borderRadius: 20,
  background: "linear-gradient(135deg, #0b1020, #111a33)",
  border: "1px solid #1f2a44",
  color: "#e5e7eb",
  boxShadow: "0 20px 60px rgba(0,0,0,0.5)",
  pointerEvents: "auto",
};

const arena: React.CSSProperties = {
  marginTop: 18,
  display: "grid",
  gridTemplateColumns: "1fr auto 1fr",
  gap: 20,
  alignItems: "center",
};

const fighterCol: React.CSSProperties = {
  display: "grid",
  justifyItems: "center",
  gap: 10,
};

const fighterName: React.CSSProperties = {
  fontSize: 18,
  fontWeight: 800,
};

const vsText: React.CSSProperties = {
  fontSize: 28,
  fontWeight: 900,
  color: "#fbbf24",
};

const spriteStyle: React.CSSProperties = {
  width: 120,
  height: 120,
  objectFit: "contain",
};

const enemyActionBox: React.CSSProperties = {
  marginTop: 18,
  padding: "12px 14px",
  borderRadius: 14,
  border: "1px solid #334155",
  background: "rgba(15, 23, 42, 0.85)",
};

const barTrack: React.CSSProperties = {
  width: 170,
  marginTop: 8,
  height: 10,
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
  color: "white",
};