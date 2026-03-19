import { useEffect, useState } from "react";
import { useGameStore } from "../store/useGameStore";
import type { Action } from "../store/useGameStore";

function spriteUrl(key?: string) {
  switch (key) {
    case "slime":
      return "/src/assets/monsters/slimeGreen.png";
    case "big-slime":
      return "/src/assets/monsters/big-slime.png";
    case "spider-blue":
      return "/src/assets/monsters/spiderBlue.png";
    case "hero":
    default:
      return "/src/assets/hero.png";
  }
}

function hpPercent(hp: number, maxHp: number) {
  return Math.max(0, Math.min(100, Math.round((hp / Math.max(1, maxHp)) * 100)));
}

export default function OptionBoard() {
  const mode = useGameStore((s) => s.mode);
  const prompt = useGameStore((s) => s.battlePrompt);
  const battleLog = useGameStore((s) => s.battleLog);
  const setPendingAction = useGameStore((s) => s.setPendingAction);

  const [heroAnimTick, setHeroAnimTick] = useState(0);
  const [enemyAnimTick, setEnemyAnimTick] = useState(0);

  useEffect(() => {
    if (!prompt) return;

    if (prompt.lastAction === "FIGHT") {
      setHeroAnimTick((n) => n + 1);
    }

    if (prompt.heroHit) {
      setEnemyAnimTick((n) => n + 1);
    }

    if (prompt.enemyHit) {
      setHeroAnimTick((n) => n + 1);
    }

    if (prompt.enemyDead) {
      setEnemyAnimTick((n) => n + 1);
    }

    if (prompt.heroDead) {
      setHeroAnimTick((n) => n + 1);
    }
  }, [
    prompt?.lastAction,
    prompt?.heroHit,
    prompt?.enemyHit,
    prompt?.enemyDead,
    prompt?.heroDead,
    prompt?.heroHp,
    prompt?.enemyHp,
  ]);

  if (!prompt || mode !== "TRAINING") return null;

  const choose = (a: Action) => {
    setPendingAction(a);
  };

  const heroHpPct = hpPercent(prompt.heroHp, prompt.heroMaxHp);
  const enemyHpPct = hpPercent(prompt.enemyHp, prompt.enemyMaxHp);

  const heroClass = [
    "battleSprite",
    prompt.lastAction === "FIGHT" ? "heroAttack" : "",
    prompt.enemyHit ? "gotHit" : "",
    prompt.heroDead ? "deadRed" : "",
  ]
    .filter(Boolean)
    .join(" ");

  const enemyClass = [
    "battleSprite",
    prompt.heroHit ? "enemyAttack" : "",
    prompt.heroHit ? "gotHit" : "",
    prompt.enemyDead ? "deadRed" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div style={overlay}>
      <div style={card}>
        <div style={headerRow}>
          <div>
            <div style={title}>Battle: {prompt.enemyName}</div>
            <div style={subtitle}>Pick an action:</div>
          </div>

          <div style={enemyHpTop}>
            Enemy HP: {prompt.enemyHp}/{prompt.enemyMaxHp}
          </div>
        </div>

        <div style={arena}>
          <div style={fighterCol}>
            <div style={fighterName}>Hero</div>

            <div style={spriteFrameHero} key={`hero-wrap-${heroAnimTick}`}>
              <img
                src={spriteUrl(prompt.heroSprite)}
                alt="Hero"
                className={heroClass}
                style={spriteStyle}
              />
            </div>

            <div style={healthPanel}>
              <div style={healthLabel}>Your Health</div>
              <div style={healthValue}>
                {prompt.heroHp}/{prompt.heroMaxHp}
              </div>
              <div style={barTrack}>
                <div
                  style={{
                    ...barFillHero,
                    width: `${heroHpPct}%`,
                  }}
                />
              </div>
            </div>
          </div>

          <div style={vsWrap}>
            <div style={vsText}>VS</div>
          </div>

          <div style={fighterCol}>
            <div style={fighterName}>{prompt.enemyName}</div>

            <div style={spriteFrameEnemy} key={`enemy-wrap-${enemyAnimTick}`}>
              <img
                src={spriteUrl(prompt.enemySprite)}
                alt={prompt.enemyName}
                className={enemyClass}
                style={spriteStyle}
              />
            </div>

            <div style={healthPanel}>
              <div style={healthLabel}>{prompt.enemyName} Health</div>
              <div style={healthValue}>
                {prompt.enemyHp}/{prompt.enemyMaxHp}
              </div>
              <div style={barTrack}>
                <div
                  style={{
                    ...barFillEnemy,
                    width: `${enemyHpPct}%`,
                  }}
                />
              </div>
            </div>
          </div>
        </div>

        <div style={enemyActionBox}>
          <div style={feedLabel}>Battle Feed</div>
          <div style={feedText}>
            {battleLog || "Choose an action to begin."}
          </div>
        </div>

        <div style={buttonGrid}>
          <button style={btnPrimary} onClick={() => choose("FIGHT")}>
            Fight
          </button>
          <button style={btn} onClick={() => choose("HIDE")}>
            Hide
          </button>
          <button style={btn} onClick={() => choose("HEAL")}>
            Heal
          </button>
          <button style={btn} onClick={() => choose("RUN")}>
            Run
          </button>
        </div>

        <div style={footerText}>
          This choice becomes a training example for the AI.
        </div>
      </div>

      <style>{`
        .battleSprite {
          width: 132px;
          height: 132px;
          object-fit: contain;
          image-rendering: pixelated;
          will-change: transform, filter, opacity;
        }

        .heroAttack {
          animation: heroAttackAnim 260ms ease;
        }

        .enemyAttack {
          animation: enemyAttackAnim 260ms ease;
        }

        .gotHit {
          animation: gotHitAnim 220ms ease;
        }

        .deadRed {
          filter: brightness(0.72) sepia(1) saturate(8) hue-rotate(-35deg);
          opacity: 0.88;
        }

        @keyframes heroAttackAnim {
          0% { transform: translateX(0) scale(1); }
          40% { transform: translateX(48px) scale(1.12); }
          100% { transform: translateX(0) scale(1); }
        }

        @keyframes enemyAttackAnim {
          0% { transform: translateX(0) scale(1); }
          40% { transform: translateX(-48px) scale(1.12); }
          100% { transform: translateX(0) scale(1); }
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
  width: 780,
  maxWidth: "calc(100vw - 32px)",
  padding: 28,
  borderRadius: 22,
  background: "linear-gradient(135deg, #0b1020, #111a33)",
  border: "1px solid #1f2a44",
  color: "#e5e7eb",
  boxShadow: "0 20px 60px rgba(0,0,0,0.5)",
  pointerEvents: "auto",
};

const headerRow: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 16,
};

const title: React.CSSProperties = {
  fontSize: 30,
  fontWeight: 900,
};

const subtitle: React.CSSProperties = {
  fontSize: 15,
  opacity: 0.9,
};

const enemyHpTop: React.CSSProperties = {
  fontSize: 16,
  opacity: 0.95,
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
  gap: 12,
};

const fighterName: React.CSSProperties = {
  fontSize: 18,
  fontWeight: 800,
};

const spriteFrameHero: React.CSSProperties = {
  width: 190,
  height: 170,
  borderRadius: 18,
  display: "grid",
  placeItems: "center",
  background: "radial-gradient(circle at center, rgba(34,197,94,0.18), rgba(15,23,42,0.05) 70%)",
};

const spriteFrameEnemy: React.CSSProperties = {
  width: 190,
  height: 170,
  borderRadius: 18,
  display: "grid",
  placeItems: "center",
  background: "radial-gradient(circle at center, rgba(239,68,68,0.18), rgba(15,23,42,0.05) 70%)",
};

const spriteStyle: React.CSSProperties = {
  width: 132,
  height: 132,
  objectFit: "contain",
};

const vsWrap: React.CSSProperties = {
  display: "grid",
  placeItems: "center",
};

const vsText: React.CSSProperties = {
  fontSize: 32,
  fontWeight: 900,
  color: "#fbbf24",
  letterSpacing: 1,
};

const enemyActionBox: React.CSSProperties = {
  marginTop: 18,
  padding: "12px 14px",
  borderRadius: 14,
  border: "1px solid #334155",
  background: "rgba(15, 23, 42, 0.85)",
};

const feedLabel: React.CSSProperties = {
  fontSize: 12,
  opacity: 0.75,
  textTransform: "uppercase",
  letterSpacing: 0.4,
};

const feedText: React.CSSProperties = {
  marginTop: 6,
  fontSize: 18,
  fontWeight: 700,
  minHeight: 24,
};

const healthPanel: React.CSSProperties = {
  width: 220,
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

const buttonGrid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: 10,
  marginTop: 16,
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

const footerText: React.CSSProperties = {
  marginTop: 12,
  fontSize: 12,
  opacity: 0.75,
};