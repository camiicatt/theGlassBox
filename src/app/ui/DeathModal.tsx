import { useEffect, useState } from "react";
import { useGameStore } from "../store/useGameStore";
import { createRun, createPlayerStats, logLeaderboard, fetchLeaderboard, closeSession } from "../../lib/supabaseLogger";
import { downloadStudentBackup } from "../../lib/fileBackup";

type LeaderboardEntry = { id: number; player_name: string; score: number };

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
  const studentId = useGameStore((s) => s.studentId);
  const score = useGameStore((s) => s.score);
  const sessionStartTime = useGameStore((s) => s.sessionStartTime);

  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    if (!heroDead) {
      setEntries([]);
      setLoading(true);
      setSubmitted(false);
      return;
    }

    async function submitAndFetch() {
      setLoading(true);
      if (studentId) {
        await logLeaderboard(studentId, score);
        setSubmitted(true);
      }
      const rows = await fetchLeaderboard();
      setEntries(rows);
      setLoading(false);
    }

    submitAndFetch();
  }, [heroDead]);

  if (!heroDead) return null;

  const playerRank = entries.findIndex((e) => e.player_name === studentId && e.score === score) + 1;

  return (
    <div style={overlay}>
      <div style={card}>
        <div style={{ fontFamily: `"Cinzel", "Trajan Pro", Georgia, serif`, fontSize: 24, fontWeight: 900, letterSpacing: 1, color: "#e2503f", textShadow: "0 0 16px rgba(200,55,40,0.4)", marginBottom: 4 }}>💀 Game Over</div>
        <div style={{ fontSize: 14, color: "#b3aaa2", marginBottom: 16 }}>
          {submitted && studentId
            ? `${studentId} — ${score} pts${playerRank > 0 ? ` · Rank #${playerRank}` : ""}`
            : "Your score has been recorded."}
        </div>

        <div style={{ fontWeight: 800, fontSize: 13, color: "#f8fafc", marginBottom: 8, textTransform: "uppercase", letterSpacing: 1 }}>
          🏆 Leaderboard
        </div>

        <div style={tableWrap}>
          {loading ? (
            <div style={{ textAlign: "center", padding: 24, color: "#64748b" }}>Loading…</div>
          ) : entries.length === 0 ? (
            <div style={{ textAlign: "center", padding: 24, color: "#64748b" }}>No entries yet.</div>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ color: "#64748b", fontSize: 11, textTransform: "uppercase" }}>
                  <th style={th}>#</th>
                  <th style={{ ...th, textAlign: "left" }}>Player</th>
                  <th style={{ ...th, textAlign: "right" }}>Score</th>
                </tr>
              </thead>
              <tbody>
                {entries.slice(0, 10).map((entry, i) => {
                  const isMe = entry.player_name === studentId && entry.score === score;
                  return (
                    <tr
                      key={entry.id}
                      style={{
                        background: isMe ? "rgba(155,45,45,0.25)" : i % 2 === 0 ? "rgba(226,80,63,0.05)" : "transparent",
                        borderRadius: 6,
                      }}
                    >
                      <td style={{ ...td, color: i === 0 ? "#facc15" : i === 1 ? "#94a3b8" : i === 2 ? "#b45309" : "#475569", fontWeight: 800 }}>
                        {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : i + 1}
                      </td>
                      <td style={{ ...td, fontWeight: isMe ? 800 : 500, color: isMe ? "#e2503f" : "#e7ddd5" }}>
                        {entry.player_name}{isMe ? " ← you" : ""}
                      </td>
                      <td style={{ ...td, textAlign: "right", fontWeight: 700, color: "#f8fafc" }}>
                        {entry.score}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
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
          onClick={async () => {
            if (supabaseSessionId !== null && sessionStartTime !== null) {
              await closeSession(supabaseSessionId, sessionStartTime, score, 0);
            }
            if (studentId) await downloadStudentBackup(studentId);
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
  background: "rgba(0,0,0,0.75)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  zIndex: 999,
};

const DUNGEON_DISPLAY = `"Cinzel", "Trajan Pro", Georgia, serif`;

const card: React.CSSProperties = {
  width: 460,
  maxWidth: "95vw",
  padding: 20,
  borderRadius: 16,
  background:
    "radial-gradient(130% 90% at 50% 0%, #282321 0%, #1b1816 45%, #120f0e 100%)",
  border: "2px solid #9b2d2d",
  boxShadow: "0 0 24px rgba(155,45,45,0.3), inset 0 1px 0 rgba(226,80,63,0.10)",
  color: "#e7ddd5",
};

const tableWrap: React.CSSProperties = {
  background: "rgba(10,6,3,0.6)",
  border: "1px solid rgba(148,120,114,0.4)",
  borderRadius: 10,
  overflow: "hidden",
  marginBottom: 4,
  maxHeight: 280,
  overflowY: "auto",
};

const th: React.CSSProperties = {
  padding: "8px 12px",
  fontWeight: 700,
  borderBottom: "1px solid rgba(148,120,114,0.4)",
  textAlign: "center",
};

const td: React.CSSProperties = {
  padding: "7px 12px",
  fontSize: 13,
};

const btnBase: React.CSSProperties = {
  width: "100%",
  marginTop: 10,
  padding: "12px 12px",
  borderRadius: 10,
  border: "1px solid rgba(148,120,114,0.45)",
  background: "rgba(20,14,9,0.6)",
  color: "#e7ddd5",
  fontFamily: DUNGEON_DISPLAY,
  fontWeight: 700,
  letterSpacing: 0.4,
  cursor: "pointer",
};

const btnPrimary: React.CSSProperties = {
  ...btnBase,
  border: "1px solid rgba(0,0,0,0.45)",
  background: "linear-gradient(180deg, #c0392b, #7f1d16)",
  color: "#f6e7e2",
  boxShadow: "inset 0 1px 0 rgba(255,255,255,0.2)",
};

const btn: React.CSSProperties = btnBase;
