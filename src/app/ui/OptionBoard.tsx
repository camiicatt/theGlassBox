import { useEffect, useMemo, useState } from "react";
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

type FxParticle = {
  id: string;
  x: number;
  y: number;
  text: string;
  kind: "heal" | "fight" | "run" | "hide";
};

function uid() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export default function OptionBoard() {
  const mode = useGameStore((s) => s.mode);
  const prompt = useGameStore((s) => s.battlePrompt);
  const battleLog = useGameStore((s) => s.battleLog);
  const setPendingAction = useGameStore((s) => s.setPendingAction);

  const [heroFx, setHeroFx] = useState<FxParticle[]>([]);
  const [enemyFx, setEnemyFx] = useState<FxParticle[]>([]);
  const [selectedAction, setSelectedAction] = useState<Action | null>(null);

  // These keys force the wrapper div to remount so the CSS animation reliably restarts.
  const heroMotionKey = useMemo(() => {
    if (!prompt) return "hero-idle";
    return [
      prompt.lastAction ?? "NONE",
      prompt.enemyHit ? "enemyHit" : "noEnemyHit",
      prompt.heroDead ? "heroDead" : "heroAlive",
      prompt.heroHp,
    ].join("-");
  }, [prompt?.lastAction, prompt?.enemyHit, prompt?.heroDead, prompt?.heroHp]);

  const enemyMotionKey = useMemo(() => {
    if (!prompt) return "enemy-idle";
    return [
      prompt.heroHit ? "heroHit" : "noHeroHit",
      prompt.enemyDead ? "enemyDead" : "enemyAlive",
      prompt.enemyHp,
    ].join("-");
  }, [prompt?.heroHit, prompt?.enemyDead, prompt?.enemyHp]);

  useEffect(() => {
    if (!prompt) return;

    if (prompt.lastAction === "FIGHT") {
      const id = uid();
      setEnemyFx((prev) => [
        ...prev,
        { id, x: 50, y: 42, text: "⚔", kind: "fight" },
      ]);
      window.setTimeout(() => {
        setEnemyFx((prev) => prev.filter((p) => p.id !== id));
      }, 520);
    }

    if (prompt.lastAction === "HEAL") {
      const particles = Array.from({ length: 6 }, (_, i) => ({
        id: uid(),
        x: 28 + (i % 3) * 20,
        y: 38 + Math.floor(i / 3) * 16,
        text: "+",
        kind: "heal" as const,
      }));

      setHeroFx((prev) => [...prev, ...particles]);

      particles.forEach((p, i) => {
        window.setTimeout(() => {
          setHeroFx((prev) => prev.filter((fx) => fx.id !== p.id));
        }, 820 + i * 35);
      });
    }

    if (prompt.lastAction === "RUN") {
      const id = uid();
      setHeroFx((prev) => [
        ...prev,
        { id, x: 55, y: 45, text: ">>", kind: "run" },
      ]);
      window.setTimeout(() => {
        setHeroFx((prev) => prev.filter((p) => p.id !== id));
      }, 620);
    }

    if (prompt.lastAction === "HIDE") {
      const id = uid();
      setHeroFx((prev) => [
        ...prev,
        { id, x: 50, y: 42, text: "☁", kind: "hide" },
      ]);
      window.setTimeout(() => {
        setHeroFx((prev) => prev.filter((p) => p.id !== id));
      }, 680);
    }
  }, [
    prompt?.lastAction,
    prompt?.heroHit,
    prompt?.enemyHit,
    prompt?.heroDead,
    prompt?.enemyDead,
    prompt?.heroHp,
    prompt?.enemyHp,
  ]);

  if (!prompt || mode !== "TRAINING") return null;

  const choose = (a: Action) => {
    setSelectedAction(a);
    setPendingAction(a);

    window.setTimeout(() => {
      setSelectedAction((curr) => (curr === a ? null : curr));
    }, 180);
  };

  const heroHpPct = hpPercent(prompt.heroHp, prompt.heroMaxHp);
  const enemyHpPct = hpPercent(prompt.enemyHp, prompt.enemyMaxHp);

  // Move the WRAPPER, not the <img>. That makes the animation visible even
  // if the PNG has transparent padding around the character.
  const heroFrameClass = [
    "battleSpriteFrame",
    prompt.lastAction === "FIGHT" ? "heroAttack" : "",
    prompt.lastAction === "HEAL" ? "heroHealPulse" : "",
    prompt.lastAction === "HIDE" ? "heroHideFade" : "",
    prompt.lastAction === "RUN" ? "heroRunStep" : "",
    prompt.enemyHit ? "gotHit" : "",
    prompt.heroDead ? "deadRed" : "",
  ]
    .filter(Boolean)
    .join(" ");

  const enemyFrameClass = [
    "battleSpriteFrame",
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

            <div
              key={heroMotionKey}
              style={spriteFrameHero}
              className={heroFrameClass}
            >
              <img
                src={spriteUrl(prompt.heroSprite)}
                alt="Hero"
                style={spriteStyle}
              />

              {heroFx.map((fx) => (
                <div
                  key={fx.id}
                  className={`fxParticle ${fx.kind}`}
                  style={{ left: `${fx.x}%`, top: `${fx.y}%` }}
                >
                  {fx.text}
                </div>
              ))}
            </div>

            <div style={healthPanel}>
              <div style={healthLabel}>Your Health</div>
              <div style={healthValue}>
                {prompt.heroHp}/{prompt.heroMaxHp}
              </div>
              <div style={barTrack}>
                <div style={{ ...barFillHero, width: `${heroHpPct}%` }} />
              </div>
            </div>
          </div>

          <div style={vsWrap}>
            <div style={vsText}>VS</div>
          </div>

          <div style={fighterCol}>
            <div style={fighterName}>{prompt.enemyName}</div>

            <div
              key={enemyMotionKey}
              style={spriteFrameEnemy}
              className={enemyFrameClass}
            >
              <img
                src={spriteUrl(prompt.enemySprite)}
                alt={prompt.enemyName}
                style={spriteStyle}
              />

              {enemyFx.map((fx) => (
                <div
                  key={fx.id}
                  className={`fxParticle ${fx.kind}`}
                  style={{ left: `${fx.x}%`, top: `${fx.y}%` }}
                >
                  {fx.text}
                </div>
              ))}
            </div>

            <div style={healthPanel}>
              <div style={healthLabel}>{prompt.enemyName} Health</div>
              <div style={healthValue}>
                {prompt.enemyHp}/{prompt.enemyMaxHp}
              </div>
              <div style={barTrack}>
                <div style={{ ...barFillEnemy, width: `${enemyHpPct}%` }} />
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
          <button
            style={{
              ...fightBtn,
              ...(selectedAction === "FIGHT" ? pressedBtn : {}),
            }}
            onClick={() => choose("FIGHT")}
          >
            ⚔ Fight
          </button>

          <button
            style={{
              ...hideBtn,
              ...(selectedAction === "HIDE" ? pressedBtn : {}),
            }}
            onClick={() => choose("HIDE")}
          >
            👤 Hide
          </button>

          <button
            style={{
              ...healBtn,
              ...(selectedAction === "HEAL" ? pressedBtn : {}),
            }}
            onClick={() => choose("HEAL")}
          >
            ✚ Heal
          </button>

          <button
            style={{
              ...runBtn,
              ...(selectedAction === "RUN" ? pressedBtn : {}),
            }}
            onClick={() => choose("RUN")}
          >
            ➜ Run
          </button>
        </div>

        <div style={footerText}>
          This choice becomes a training example for the AI.
        </div>
      </div>

      <style>{`
        .battleSpriteFrame {
          will-change: transform, filter, opacity;
          position: relative;
        }

        .heroAttack {
          animation: heroAttackAnim 480ms cubic-bezier(.2,.8,.2,1);
        }

        .heroHealPulse {
          animation: heroHealPulseAnim 540ms ease;
        }

        .heroHideFade {
          animation: heroHideFadeAnim 480ms ease;
        }

        .heroRunStep {
          animation: heroRunStepAnim 380ms ease;
        }

        .gotHit {
          animation: gotHitAnim 340ms ease;
        }

        .deadRed {
          filter: brightness(0.72) sepia(1) saturate(8) hue-rotate(-35deg);
          opacity: 0.88;
        }

        .fxParticle {
          position: absolute;
          transform: translate(-50%, -50%);
          pointer-events: none;
          z-index: 5;
          font-weight: 900;
          text-shadow: 0 2px 10px rgba(0,0,0,0.45);
          animation: floatUpFade 900ms ease-out forwards;
        }

        .fxParticle.heal {
          color: #86efac;
          font-size: 30px;
        }

        .fxParticle.fight {
          color: #fca5a5;
          font-size: 28px;
        }

        .fxParticle.run {
          color: #fde68a;
          font-size: 24px;
        }

        .fxParticle.hide {
          color: #cbd5e1;
          font-size: 28px;
        }

        @keyframes heroAttackAnim {
          0% { transform: translateX(0) scale(1); }
          35% { transform: translateX(96px) scale(1.2); }
          100% { transform: translateX(0) scale(1); }
        }

        @keyframes gotHitAnim {
          0% { transform: translateX(0); }
          20% { transform: translateX(-18px); }
          40% { transform: translateX(18px); }
          60% { transform: translateX(-12px); }
          80% { transform: translateX(12px); }
          100% { transform: translateX(0); }
        }

        @keyframes heroHealPulseAnim {
          0% { transform: scale(1); filter: brightness(1); }
          35% { transform: scale(1.09); filter: brightness(1.25); }
          100% { transform: scale(1); filter: brightness(1); }
        }

        @keyframes heroHideFadeAnim {
          0% { transform: scale(1); opacity: 1; }
          50% { transform: scale(0.95); opacity: 0.45; }
          100% { transform: scale(1); opacity: 1; }
        }

        @keyframes heroRunStepAnim {
          0% { transform: translateX(0) scale(1); }
          35% { transform: translateX(-28px) scale(1.04); }
          100% { transform: translateX(0) scale(1); }
        }

        @keyframes floatUpFade {
          0% {
            opacity: 0;
            transform: translate(-50%, -50%) translateY(10px) scale(0.8);
          }
          20% {
            opacity: 1;
            transform: translate(-50%, -50%) translateY(0px) scale(1);
          }
          100% {
            opacity: 0;
            transform: translate(-50%, -50%) translateY(-34px) scale(1.18);
          }
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
  position: "relative",
  overflow: "hidden",
  background:
    "radial-gradient(circle at center, rgba(34,197,94,0.18), rgba(15,23,42,0.05) 70%)",
};

const spriteFrameEnemy: React.CSSProperties = {
  width: 190,
  height: 170,
  borderRadius: 18,
  display: "grid",
  placeItems: "center",
  position: "relative",
  overflow: "hidden",
  background:
    "radial-gradient(circle at center, rgba(239,68,68,0.18), rgba(15,23,42,0.05) 70%)",
};

const spriteStyle: React.CSSProperties = {
  width: 132,
  height: 132,
  objectFit: "contain",
  imageRendering: "pixelated",
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

const baseActionBtn: React.CSSProperties = {
  padding: "14px 12px",
  borderRadius: 14,
  border: "1px solid transparent",
  color: "white",
  fontWeight: 900,
  fontSize: 17,
  cursor: "pointer",
  transition: "transform 120ms ease, filter 120ms ease, box-shadow 120ms ease",
  boxShadow: "0 8px 18px rgba(0,0,0,0.22)",
};

const fightBtn: React.CSSProperties = {
  ...baseActionBtn,
  background: "linear-gradient(135deg, #ef4444, #b91c1c)",
  border: "1px solid #f87171",
};

const hideBtn: React.CSSProperties = {
  ...baseActionBtn,
  background: "linear-gradient(135deg, #64748b, #334155)",
  border: "1px solid #94a3b8",
};

const healBtn: React.CSSProperties = {
  ...baseActionBtn,
  background: "linear-gradient(135deg, #22c55e, #15803d)",
  border: "1px solid #86efac",
};

const runBtn: React.CSSProperties = {
  ...baseActionBtn,
  background: "linear-gradient(135deg, #f59e0b, #d97706)",
  border: "1px solid #fcd34d",
};

const pressedBtn: React.CSSProperties = {
  transform: "scale(0.97)",
  filter: "brightness(1.08)",
};

const footerText: React.CSSProperties = {
  marginTop: 12,
  fontSize: 12,
  opacity: 0.75,
};