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
                background: i === index ? "#60a5fa" : "#334155",
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

const overlay: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  zIndex: 500,
  display: "grid",
  placeItems: "center",
  background:
    "radial-gradient(circle at top, rgba(37,99,235,0.18), transparent 35%), linear-gradient(180deg, #020617 0%, #0f172a 100%)",
};

const card: React.CSSProperties = {
  width: 720,
  maxWidth: "calc(100vw - 32px)",
  minHeight: 360,
  borderRadius: 24,
  border: "1px solid #1e293b",
  background: "linear-gradient(135deg, #0b1120, #111827)",
  boxShadow: "0 24px 80px rgba(0,0,0,0.45)",
  padding: 32,
  color: "#e5e7eb",
  display: "flex",
  flexDirection: "column",
  justifyContent: "space-between",
};

const eyebrow: React.CSSProperties = {
  fontSize: 12,
  letterSpacing: 1.5,
  fontWeight: 800,
  color: "#93c5fd",
};

const title: React.CSSProperties = {
  fontSize: 34,
  fontWeight: 900,
  marginTop: 10,
  color: "#f8fafc",
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
  color: "#cbd5e1",
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
  border: "none",
  borderRadius: 14,
  padding: "12px 18px",
  fontWeight: 800,
  fontSize: 16,
  color: "white",
  cursor: "pointer",
  background: "linear-gradient(135deg, #2563eb, #1d4ed8)",
};

const secondaryBtn: React.CSSProperties = {
  border: "1px solid #334155",
  borderRadius: 14,
  padding: "12px 18px",
  fontWeight: 800,
  fontSize: 16,
  color: "#e5e7eb",
  cursor: "pointer",
  background: "#0f172a",
};