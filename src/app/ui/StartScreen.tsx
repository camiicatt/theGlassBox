import { useMemo, useState } from "react";
import { useGameStore } from "./store/useGameStore"; 

function makeStudentId(first: string, lastInitial: string) {
  const f = first.trim().toLowerCase().replace(/[^a-z]/g, "");
  const l = lastInitial.trim().toLowerCase().replace(/[^a-z]/g, "").slice(0, 1);
  if (!f || !l) return null;
  return `${f}-${l}`;
}

export default function StartScreen() {
  const studentId = useGameStore((s) => s.studentId);
  const setStudentId = useGameStore((s) => s.setStudentId);
  const resetForNewStudent = useGameStore((s) => s.resetForNewStudent);
  const loadFromLocal = useGameStore((s) => s.loadFromLocal);

  const [first, setFirst] = useState("");
  const [lastInitial, setLastInitial] = useState("");

  const id = useMemo(() => makeStudentId(first, lastInitial), [first, lastInitial]);

  if (studentId) return null;

  return (
    <div style={overlay}>
      <div style={card}>
        <div style={{ fontSize: 22, fontWeight: 900 }}>Dungeon Master: AI Trainer</div>
        <div style={{ marginTop: 8, opacity: 0.85, lineHeight: 1.35 }}>
          Enter your name so your training stays yours...
        </div>

        <div style={{ display: "grid", gap: 10, marginTop: 14 }}>
          <label style={label}>
            First name
            <input
              style={input}
              value={first}
              onChange={(e) => setFirst(e.target.value)}
              placeholder="Kathy"
              autoFocus
            />
          </label>

          <label style={label}>
            Last initial
            <input
              style={input}
              value={lastInitial}
              onChange={(e) => setLastInitial(e.target.value)}
              placeholder="K"
              maxLength={1}
            />
          </label>
        </div>

        <button
          disabled={!id}
          onClick={() => {
            // start fresh, then load (if exists)
            resetForNewStudent();
            setStudentId(id);
            loadFromLocal(id);
          }}
          style={{
            ...btn,
            opacity: id ? 1 : 0.5,
            cursor: id ? "pointer" : "not-allowed",
          }}
        >
          Start
        </button>

        <div style={{ marginTop: 10, fontSize: 12, opacity: 0.75 }}>
          Example format: “Kathy-K”
        </div>
      </div>
    </div>
  );
}

const overlay: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  background: "rgba(0,0,0,0.7)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  zIndex: 999,
};

const card: React.CSSProperties = {
  width: 420,
  padding: 18,
  borderRadius: 18,
  background: "linear-gradient(135deg, #0b1020, #111a33)",
  border: "1px solid #1f2a44",
  color: "#e5e7eb",
  boxShadow: "0 12px 40px rgba(0,0,0,0.45)",
};

const label: React.CSSProperties = { fontSize: 12, opacity: 0.85, display: "grid", gap: 6 };

const input: React.CSSProperties = {
  padding: "10px 12px",
  borderRadius: 12,
  border: "1px solid #1f2a44",
  background: "#0b1226",
  color: "#e5e7eb",
  outline: "none",
};

const btn: React.CSSProperties = {
  width: "100%",
  marginTop: 14,
  padding: "12px 12px",
  borderRadius: 14,
  border: "1px solid #2b3c66",
  background: "linear-gradient(135deg, #2563eb, #1d4ed8)",
  color: "white",
  fontWeight: 900,
};
