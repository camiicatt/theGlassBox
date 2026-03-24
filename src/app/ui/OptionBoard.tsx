import { useEffect, useMemo, useState } from "react";
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

const ACTION_ORDER: Action[] = ["FIGHT", "HIDE", "HEAL", "RUN"];

function actionLabel(action: Action) {
  switch (action) {
    case "FIGHT":
      return "⚔ Fight";
    case "HIDE":
      return "👤 Hide";
    case "HEAL":
      return "✚ Heal";
    case "RUN":
      return "➜ Run";
    default:
      return action;
  }
}

function actionPct(
  probs: Partial<Record<Action, number>> | undefined,
  action: Action
) {
  const raw = probs?.[action] ?? 0;
  return Math.max(0, Math.min(100, Math.round(raw * 100)));
}

export default function OptionBoard() {
  const mode = useGameStore((s) => s.mode);
  const prompt = useGameStore((s) => s.battlePrompt);
  const battleLog = useGameStore((s) => s.battleLog);
  const setPendingAction = useGameStore((s) => s.setPendingAction);
  const prediction = useGameStore((s) => s.prediction);

  const [heroFx, setHeroFx] = useState<FxParticle[]>([]);
  const [enemyFx, setEnemyFx] = useState<FxParticle[]>([]);
  const [selectedAction, setSelectedAction] = useState<Action | null>(null);

  const isTrainingMode = mode === "TRAINING";
  const isAiMode = mode === "AI_RUN";
  const isInteractive = isTrainingMode;

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

  const heroMotionKey = useMemo(() => {
    if (!prompt) return "hero-idle";
    return [
      prompt.lastAction ?? "NONE",
      prompt.enemyHit ? "enemyHit" : "noEnemyHit",
      prompt.heroDead ? "heroDead" : "heroAlive",
      prompt.heroHp,
      prompt.aiChosenAction ?? "no-ai-choice",
    ].join("-");
  }, [
    prompt?.lastAction,
    prompt?.enemyHit,
    prompt?.heroDead,
    prompt?.heroHp,
    prompt?.aiChosenAction,
  ]);

  const enemyMotionKey = useMemo(() => {
    if (!prompt) return "enemy-idle";
    return [
      prompt.heroHit ? "heroHit" : "noHeroHit",
      prompt.enemyDead ? "enemyDead" : "enemyAlive",
      prompt.enemyHp,
    ].join("-");
  }, [prompt?.heroHit, prompt?.enemyDead, prompt?.enemyHp]);

  if (!prompt || (!isTrainingMode && !isAiMode)) return null;

  const choose = (a: Action) => {
    if (!isInteractive) return;

    setSelectedAction(a);
    setPendingAction(a);

    window.setTimeout(() => {
      setSelectedAction((curr) => (curr === a ? null : curr));
    }, 180);
  };

  const heroHpPct = hpPercent(prompt.heroHp, prompt.heroMaxHp);
  const enemyHpPct = hpPercent(prompt.enemyHp, prompt.enemyMaxHp);

  const aiChosenAction = prompt.aiChosenAction ?? null;
  const aiThinking = !!prompt.aiThinking;

  const probs =
    prompt.aiProbs ??
    (isAiMode && prediction?.probs ? (prediction.probs as Partial<Record<Action, number>>) : undefined);

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

  const topRightLabel = isAiMode
    ? `AI confidence: ${Math.round((prompt.aiConfidence ?? prediction?.confidence ?? 0) * 100)}%`
    : `Enemy HP: ${prompt.enemyHp}/${prompt.enemyMaxHp}`;

  const feedMessage = isAiMode
    ? aiThinking
      ? "The AI is looking at the choices..."
      : aiChosenAction
      ? `The AI chose ${aiChosenAction}.`
      : battleLog || "The AI is deciding."
    : battleLog || "Choose an action to begin.";

  const actionButtonStyle = (action: Action) => {
    const base =
      action === "FIGHT"
        ? fightBtn
        : action === "HIDE"
        ? hideBtn
        : action === "HEAL"
        ? healBtn
        : runBtn;

    return {
      ...base,
      ...(selectedAction === action ? pressedBtn : {}),
      ...(aiChosenAction === action ? aiChosenBtn : {}),
      cursor: isInteractive ? "pointer" : "default",
      opacity: aiThinking || isInteractive ? 1 : 0.96,
    };
  };

  return (
    <div style={overlay}>
      <div style={card}>
        <div style={headerRow}>
          <div>
            <div style={title}>
              {isAiMode ? "AI Choice Mode" : `Battle: ${prompt.enemyName}`}
            </div>
            <div style={subtitle}>
              {isAiMode
                ? "Watch the AI think, compare the confidence levels, then see the action happen."
                : "Pick an action:"}
            </div>
          </div>

          <div style={enemyHpTop}>{topRightLabel}</div>
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
            <div style={vsText}>{isAiMode ? "AI" : "VS"}</div>
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
          <div style={feedLabel}>{isAiMode ? "AI Battle Feed" : "Battle Feed"}</div>
          <div style={feedText}>{feedMessage}</div>
        </div>

        <div style={buttonGrid}>
          {ACTION_ORDER.map((action) => {
            const pct = actionPct(probs, action);

            return (
              <button
                key={action}
                style={actionButtonStyle(action)}
                onClick={() => choose(action)}
                disabled={!isInteractive}
              >
                <div style={actionTitle}>{actionLabel(action)}</div>

                {isAiMode && (
                  <>
                    <div style={confidenceText}>{pct}% confidence</div>
                    <div style={miniTrack}>
                      <div style={{ ...miniFill, width: `${pct}%` }} />
                    </div>
                  </>
                )}
              </button>
            );
          })}
        </div>

        <div style={footerText}>
          {isAiMode
            ? "The AI is using what it learned from the examples."
            : "This choice becomes a training example for the AI."}
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
          50% { transform: scale(1.08); filter: brightness(1.28); }
          100% { transform: scale(1); filter: brightness(1); }
        }

        @keyframes heroHideFadeAnim {
          0% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.38; transform: scale(0.94); }
          100% { opacity: 1; transform: scale(1); }
        }

        @keyframes heroRunStepAnim {
          0% { transform: translateX(0); }
          35% { transform: translateX(-34px); }
          100% { transform: translateX(0); }
        }

        @keyframes floatUpFade {
          0% { opacity: 0; transform: translate(-50%, -10%) scale(0.8); }
          10% { opacity: 1; }
          100% { opacity: 0; transform: translate(-50%, -140%) scale(1.12); }
        }
      `}</style>
    </div>
  );
}

const overlay: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  background: "rgba(2,6,23,0.48)",
  backdropFilter: "blur(4px)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  zIndex: 50,
  padding: 20,
};

const card: React.CSSProperties = {
  width: "min(920px, 96vw)",
  background: "linear-gradient(180deg, #0f172a 0%, #111827 100%)",
  border: "1px solid rgba(255,255,255,0.08)",
  borderRadius: 24,
  boxShadow: "0 24px 70px rgba(0,0,0,0.42)",
  padding: 22,
  color: "#f8fafc",
};

const headerRow: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: 16,
  marginBottom: 18,
};

const title: React.CSSProperties = {
  fontSize: 28,
  fontWeight: 900,
  letterSpacing: 0.3,
};

const subtitle: React.CSSProperties = {
  marginTop: 6,
  fontSize: 14,
  color: "#cbd5e1",
  lineHeight: 1.4,
  maxWidth: 520,
};

const enemyHpTop: React.CSSProperties = {
  background: "rgba(255,255,255,0.06)",
  border: "1px solid rgba(255,255,255,0.08)",
  borderRadius: 999,
  padding: "10px 14px",
  fontWeight: 800,
  fontSize: 14,
  whiteSpace: "nowrap",
};

const arena: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr auto 1fr",
  gap: 18,
  alignItems: "center",
  marginBottom: 18,
};

const fighterCol: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  gap: 12,
};

const fighterName: React.CSSProperties = {
  fontSize: 18,
  fontWeight: 900,
};

const spriteFrameHero: React.CSSProperties = {
  width: 190,
  height: 190,
  borderRadius: 22,
  background: "radial-gradient(circle at 50% 35%, rgba(59,130,246,0.22), rgba(15,23,42,0.2))",
  border: "1px solid rgba(255,255,255,0.08)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  position: "relative",
  overflow: "hidden",
};

const spriteFrameEnemy: React.CSSProperties = {
  width: 190,
  height: 190,
  borderRadius: 22,
  background: "radial-gradient(circle at 50% 35%, rgba(239,68,68,0.2), rgba(15,23,42,0.2))",
  border: "1px solid rgba(255,255,255,0.08)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  position: "relative",
  overflow: "hidden",
};

const spriteStyle: React.CSSProperties = {
  width: 130,
  height: 130,
  objectFit: "contain",
  imageRendering: "pixelated",
};

const vsWrap: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};

const vsText: React.CSSProperties = {
  fontSize: 28,
  fontWeight: 900,
  color: "#fde68a",
  opacity: 0.9,
};

const healthPanel: React.CSSProperties = {
  width: "100%",
  maxWidth: 220,
  background: "rgba(255,255,255,0.04)",
  borderRadius: 16,
  padding: 12,
  border: "1px solid rgba(255,255,255,0.08)",
};

const healthLabel: React.CSSProperties = {
  fontSize: 12,
  color: "#cbd5e1",
  marginBottom: 4,
  fontWeight: 700,
};

const healthValue: React.CSSProperties = {
  fontSize: 16,
  fontWeight: 900,
  marginBottom: 8,
};

const barTrack: React.CSSProperties = {
  width: "100%",
  height: 12,
  background: "rgba(255,255,255,0.08)",
  borderRadius: 999,
  overflow: "hidden",
};

const barFillHero: React.CSSProperties = {
  height: "100%",
  borderRadius: 999,
  background: "linear-gradient(90deg, #22c55e, #86efac)",
};

const barFillEnemy: React.CSSProperties = {
  height: "100%",
  borderRadius: 999,
  background: "linear-gradient(90deg, #ef4444, #fca5a5)",
};

const enemyActionBox: React.CSSProperties = {
  background: "rgba(255,255,255,0.04)",
  border: "1px solid rgba(255,255,255,0.08)",
  borderRadius: 18,
  padding: 14,
  marginBottom: 18,
};

const feedLabel: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 800,
  color: "#93c5fd",
  textTransform: "uppercase",
  letterSpacing: 0.8,
  marginBottom: 6,
};

const feedText: React.CSSProperties = {
  fontSize: 16,
  fontWeight: 700,
  lineHeight: 1.4,
};

const buttonGrid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
  gap: 12,
  marginBottom: 14,
};

const baseBtn: React.CSSProperties = {
  border: "none",
  borderRadius: 18,
  padding: "16px 16px 14px",
  color: "#fff",
  fontWeight: 900,
  fontSize: 18,
  textAlign: "left",
  transition: "transform 120ms ease, box-shadow 120ms ease, opacity 120ms ease",
  minHeight: 86,
};

const fightBtn: React.CSSProperties = {
  ...baseBtn,
  background: "linear-gradient(180deg, #dc2626, #991b1b)",
  boxShadow: "0 12px 24px rgba(127,29,29,0.35)",
};

const hideBtn: React.CSSProperties = {
  ...baseBtn,
  background: "linear-gradient(180deg, #475569, #1e293b)",
  boxShadow: "0 12px 24px rgba(15,23,42,0.35)",
};

const healBtn: React.CSSProperties = {
  ...baseBtn,
  background: "linear-gradient(180deg, #16a34a, #166534)",
  boxShadow: "0 12px 24px rgba(22,101,52,0.35)",
};

const runBtn: React.CSSProperties = {
  ...baseBtn,
  background: "linear-gradient(180deg, #d97706, #92400e)",
  boxShadow: "0 12px 24px rgba(146,64,14,0.35)",
};

const pressedBtn: React.CSSProperties = {
  transform: "translateY(2px) scale(0.985)",
};

const aiChosenBtn: React.CSSProperties = {
  outline: "3px solid rgba(255,255,255,0.88)",
  transform: "scale(1.02)",
  boxShadow: "0 0 0 5px rgba(255,255,255,0.12), 0 14px 28px rgba(0,0,0,0.32)",
};

const actionTitle: React.CSSProperties = {
  fontSize: 20,
  fontWeight: 900,
};

const confidenceText: React.CSSProperties = {
  marginTop: 6,
  fontSize: 12,
  fontWeight: 800,
  opacity: 0.95,
};

const miniTrack: React.CSSProperties = {
  marginTop: 8,
  height: 8,
  borderRadius: 999,
  background: "rgba(255,255,255,0.18)",
  overflow: "hidden",
};

const miniFill: React.CSSProperties = {
  height: "100%",
  borderRadius: 999,
  background: "rgba(255,255,255,0.92)",
};

const footerText: React.CSSProperties = {
  fontSize: 13,
  color: "#cbd5e1",
  textAlign: "center",
  fontWeight: 700,
};