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

    const startedAt = Date.now();
    const sessionId = await createSession(cleanFirst, cleanLastInitial);
    if (sessionId !== null) {
      setSupabaseSessionId(sessionId);
      setSessionStartTime(startedAt);
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
        <div style={titleText}>Dungeon Master: AI Trainer</div>
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

const DUNGEON_DISPLAY = `"Cinzel", "Trajan Pro", Georgia, serif`;

const page: React.CSSProperties = {
  minHeight: "100vh",
  background:
    "radial-gradient(120% 80% at 50% 0%, #1b1816 0%, #100e0d 60%, #0a0909 100%)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 16,
};

const card: React.CSSProperties = {
  width: 420,
  maxWidth: "100%",
  padding: 20,
  borderRadius: 16,
  background:
    "radial-gradient(130% 90% at 50% 0%, #282321 0%, #1b1816 45%, #120f0e 100%)",
  border: "2px solid #9b2d2d",
  color: "#e7ddd5",
  boxShadow:
    "0 16px 50px rgba(0,0,0,0.6), 0 0 22px rgba(155,45,45,0.3), inset 0 1px 0 rgba(226,80,63,0.10), inset 0 0 50px rgba(0,0,0,0.5)",
};

const titleText: React.CSSProperties = {
  fontFamily: DUNGEON_DISPLAY,
  fontSize: 24,
  fontWeight: 900,
  letterSpacing: 1,
  color: "#e2503f",
  textShadow: "0 2px 0 rgba(0,0,0,0.5), 0 0 18px rgba(200,55,40,0.35)",
};

const label: React.CSSProperties = {
  fontFamily: DUNGEON_DISPLAY,
  fontSize: 12,
  letterSpacing: 0.5,
  textTransform: "uppercase",
  color: "#b3aaa2",
  display: "grid",
  gap: 6,
};

const input: React.CSSProperties = {
  padding: "10px 12px",
  borderRadius: 8,
  border: "1px solid rgba(148,120,114,0.45)",
  background: "rgba(10,6,3,0.55)",
  color: "#e7ddd5",
  outline: "none",
};

const btn: React.CSSProperties = {
  width: "100%",
  marginTop: 14,
  padding: "13px 12px",
  borderRadius: 10,
  border: "1px solid rgba(0,0,0,0.45)",
  background: "linear-gradient(180deg, #c0392b, #7f1d16)",
  color: "#f6e7e2",
  fontFamily: DUNGEON_DISPLAY,
  fontWeight: 900,
  letterSpacing: 0.5,
  boxShadow: "0 10px 22px rgba(127,29,22,0.4), inset 0 1px 0 rgba(255,255,255,0.25)",
};
