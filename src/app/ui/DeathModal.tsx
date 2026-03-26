import { useGameStore } from "../store/useGameStore";
import { createRun, createPlayerStats } from "../../lib/supabaseLogger";

export default function DeathModal() {
  const heroDead = useGameStore((s) => (s as any).heroDead);
  const requestRestart = useGameStore((s) => (s as any).requestRestart);
  const resetForNewStudent = useGameStore((s) => s.resetForNewStudent);
  const setStudentId = useGameStore((s) => s.setStudentId);
  const supabaseSessionId = useGameStore((s) => s.supabaseSessionId);
  const setSupabaseRunId = useGameStore((s) => s.setSupabaseRunId);
  const setRunStartTime = useGameStore((s) => s.setRunStartTime);
  const setSupabasePlayerStatsId = useGameStore((s) => s.setSupabasePlayerStatsId);
  const setSupabaseAiStatsId = useGameStore((s) => s.setSupabaseAiStatsId);
  const setSupabaseDungeonId = useGameStore((s) => s.setSupabaseDungeonId);

  if (!heroDead) return null;

  return (
    <div style={overlay}>
      <div style={card}>
        <div style={{ fontSize: 22, fontWeight: 900 }}>💀 The robot died</div>
        <div style={{ marginTop: 8, opacity: 0.85 }}>
          Teach it what it should do next time, then respawn.
        </div>

        <button
          style={btnPrimary}
          onClick={async () => {
            setSupabaseAiStatsId(null);
            setSupabaseDungeonId(null);
            if (supabaseSessionId !== null) {
              const runId = await createRun(supabaseSessionId);
              if (runId !== null) {
                setSupabaseRunId(runId);
                setRunStartTime(Date.now());
                const playerStatsId = await createPlayerStats(runId);
                if (playerStatsId !== null) setSupabasePlayerStatsId(playerStatsId);
              }
            }
            requestRestart();
          }}
        >
          Respawn (keep learning)
        </button>

        <button
          style={btn}
          onClick={() => {
            resetForNewStudent();
            setStudentId(null);
          }}
        >
          Next student
        </button>
      </div>
    </div>
  );
}

const overlay: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  background: "rgba(0,0,0,0.6)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  zIndex: 999,
};

const card: React.CSSProperties = {
  width: 420,
  padding: 16,
  borderRadius: 16,
  background: "linear-gradient(135deg, #0b1020, #111a33)",
  border: "1px solid #1f2a44",
  color: "#e5e7eb",
};

const btnBase: React.CSSProperties = {
  width: "100%",
  marginTop: 12,
  padding: "12px 12px",
  borderRadius: 14,
  border: "1px solid #1f2a44",
  background: "#0b1226",
  color: "#e5e7eb",
  fontWeight: 900,
  cursor: "pointer",
};

const btnPrimary: React.CSSProperties = {
  ...btnBase,
  border: "1px solid #2b3c66",
  background: "linear-gradient(135deg, #2563eb, #1d4ed8)",
  color: "white",
};

const btn: React.CSSProperties = btnBase;