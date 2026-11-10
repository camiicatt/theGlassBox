import { useState } from "react";
import { useGameStore } from "../store/useGameStore";

const slides = [
  {
    title: "The Lost Robot",
    body: [
      "A dungeon scout robot has awakened with its memory erased.",
      "It can still move, but it no longer remembers how to survive.",
    ],
  },
  {
    title: "Teach It to Live",
    body: [
      "Your actions become its training data.",
      "What you demonstrate often, it becomes more confident in.",
    ],
  },
  {
    title: "Different Choices Teach Different AI",
    body: [
      "You do not have to defeat every monster.",
      "You can fight, hide, run away, or avoid danger entirely.",
    ],
  },
  {
    title: "Watch What It Learns",
    body: [
      "First, you guide the robot through a training round.",
      "Then the AI tries a similar dungeon on its own. As the game continues, the dungeons get harder.",
    ],
  },
];

export default function IntroModal() {
  const mode = useGameStore((s) => s.mode);
  const setMode = useGameStore((s) => s.setMode);

  const [index, setIndex] = useState(0);

  if (mode !== "BOOT") return null;

  const slide = slides[index];
  const isLast = index === slides.length - 1;

  return (
    <div style={overlay}>
      <div style={card}>
        <div style={eyebrow}>MEMORY CORE RECOVERY</div>

        <div style={title}>{slide.title}</div>

        <div style={bodyWrap}>
          {slide.body.map((line) => (
            <p key={line} style={bodyText}>
              {line}
            </p>
          ))}
        </div>

        <div style={progressRow}>
          {slides.map((_, i) => (
            <div
              key={i}
              style={{
                ...dot,
                background: i === index ? "#e2503f" : "#5c2626",
              }}
            />
          ))}
        </div>

        <div style={buttonRow}>
          {index > 0 ? (
            <button style={secondaryBtn} onClick={() => setIndex(index - 1)}>
              Back
            </button>
          ) : (
            <div />
          )}

          {!isLast ? (
            <button style={primaryBtn} onClick={() => setIndex(index + 1)}>
              Next
            </button>
          ) : (
            <button
              style={primaryBtn}
              onClick={() => {
                setMode("TRAINING");
              }}
            >
              Begin Training
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

const DUNGEON_DISPLAY = `"Cinzel", "Trajan Pro", Georgia, serif`;

const overlay: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  zIndex: 500,
  display: "grid",
  placeItems: "center",
  background:
    "radial-gradient(circle at top, rgba(155,45,45,0.22), transparent 40%), linear-gradient(180deg, #0a0909 0%, #100e0d 100%)",
};

const card: React.CSSProperties = {
  width: 720,
  maxWidth: "calc(100vw - 32px)",
  minHeight: 360,
  borderRadius: 18,
  border: "2px solid #9b2d2d",
  background:
    "radial-gradient(130% 90% at 50% 0%, #282321 0%, #1b1816 45%, #120f0e 100%)",
  boxShadow:
    "0 24px 80px rgba(0,0,0,0.6), 0 0 22px rgba(155,45,45,0.3), inset 0 1px 0 rgba(226,80,63,0.10)",
  padding: 32,
  color: "#e7ddd5",
  display: "flex",
  flexDirection: "column",
  justifyContent: "space-between",
};

const eyebrow: React.CSSProperties = {
  fontFamily: DUNGEON_DISPLAY,
  fontSize: 12,
  letterSpacing: 2,
  fontWeight: 700,
  color: "#c0392b",
  textTransform: "uppercase",
};

const title: React.CSSProperties = {
  fontFamily: DUNGEON_DISPLAY,
  fontSize: 34,
  fontWeight: 900,
  letterSpacing: 1,
  marginTop: 10,
  color: "#e2503f",
  textShadow: "0 2px 0 rgba(0,0,0,0.5), 0 0 18px rgba(200,55,40,0.35)",
};

const bodyWrap: React.CSSProperties = {
  marginTop: 22,
  display: "grid",
  gap: 8,
};

const bodyText: React.CSSProperties = {
  margin: 0,
  fontSize: 19,
  lineHeight: 1.55,
  color: "#b3aaa2",
};

const progressRow: React.CSSProperties = {
  display: "flex",
  gap: 8,
  alignItems: "center",
  justifyContent: "center",
  marginTop: 22,
};

const dot: React.CSSProperties = {
  width: 10,
  height: 10,
  borderRadius: 999,
};

const buttonRow: React.CSSProperties = {
  marginTop: 28,
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
};

const primaryBtn: React.CSSProperties = {
  border: "1px solid rgba(0,0,0,0.45)",
  borderRadius: 10,
  padding: "12px 20px",
  fontFamily: DUNGEON_DISPLAY,
  fontWeight: 900,
  letterSpacing: 0.5,
  fontSize: 16,
  color: "#f6e7e2",
  cursor: "pointer",
  background: "linear-gradient(180deg, #c0392b, #7f1d16)",
  boxShadow: "0 10px 22px rgba(127,29,22,0.4), inset 0 1px 0 rgba(255,255,255,0.25)",
};

const secondaryBtn: React.CSSProperties = {
  border: "1px solid rgba(148,120,114,0.45)",
  borderRadius: 10,
  padding: "12px 20px",
  fontFamily: DUNGEON_DISPLAY,
  fontWeight: 700,
  letterSpacing: 0.5,
  fontSize: 16,
  color: "#e7ddd5",
  cursor: "pointer",
  background: "rgba(20,14,9,0.55)",
};