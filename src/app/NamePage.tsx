import { useMemo, useState } from "react";
import { useGameStore } from "./store/useGameStore";
import { createSession, createRun, createPlayerStats } from "../lib/supabaseLogger";

function makeStudentId(first: string, lastInitial: string) {
  const f = first.trim().toLowerCase().replace(/[^a-z]/g, "");
  const l = lastInitial.trim().toLowerCase().replace(/[^a-z]/g, "").slice(0, 1);
  if (!f || !l) return null;
  return `${f}-${l}`;
}

export default function NamePage() {
  const setStudentId = useGameStore((s) => s.setStudentId);
  const resetForNewStudent = useGameStore((s) => s.resetForNewStudent);
  const loadFromLocal = useGameStore((s) => s.loadFromLocal);
  const setSupabaseSessionId = useGameStore((s) => s.setSupabaseSessionId);
  const setSessionStartTime = useGameStore((s) => s.setSessionStartTime);
  const setSupabaseRunId = useGameStore((s) => s.setSupabaseRunId);
  const setRunStartTime = useGameStore((s) => s.setRunStartTime);
  const setSupabasePlayerStatsId = useGameStore((s) => s.setSupabasePlayerStatsId);

  const [first, setFirst] = useState("");
  const [lastInitial, setLastInitial] = useState("");
  const [saveError, setSaveError] = useState<string | null>(null);

  const id = useMemo(() => makeStudentId(first, lastInitial), [first, lastInitial]);

  const handleStart = async () => {
    if (!id) return;
    setSaveError(null);

    const cleanFirst = first.trim();
    const cleanLastInitial = lastInitial.trim().slice(0, 1).toUpperCase();

    // Reset and start the game immediately — Supabase IDs are set async afterward
    resetForNewStudent();
    setStudentId(id);
    loadFromLocal(id);

    const sessionId = await createSession(cleanFirst, cleanLastInitial);
    if (sessionId !== null) {
      setSupabaseSessionId(sessionId);
      setSessionStartTime(Date.now());
      const runId = await createRun(sessionId);
      if (runId !== null) {
        setSupabaseRunId(runId);
        setRunStartTime(Date.now());
        const playerStatsId = await createPlayerStats(runId);
        if (playerStatsId !== null) setSupabasePlayerStatsId(playerStatsId);
      }
    } else {
      setSaveError("Could not save session to Supabase. Check table/policies.");
    }
  };

  return (
    <div style={page}>
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
          onClick={handleStart}
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
        {saveError ? (
          <div style={{ marginTop: 8, fontSize: 12, color: "#fca5a5" }}>{saveError}</div>
        ) : null}
      </div>
    </div>
  );
}

const page: React.CSSProperties = {
  minHeight: "100vh",
  background: "#050814",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 16,
};

const card: React.CSSProperties = {
  width: 420,
  maxWidth: "100%",
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
