import { useGameStore } from "./store/useGameStore";
import { useMemo } from "react";

export default function RightPanel() {
  const mode = useGameStore((s) => s.mode);
  const examples = useGameStore((s) => s.examples);
  const examplesCount = examples.length;
  const clearExamples = useGameStore((s) => s.clearExamples);
  const setStudentId = useGameStore((s) => s.setStudentId);
  const resetForNewStudent = useGameStore((s) => s.resetForNewStudent);

  const actionCounts = useMemo(() => {
    const counts: Record<string, number> = {
      UP: 0,
      DOWN: 0,
      LEFT: 0,
      RIGHT: 0,
      ATTACK: 0,
      WAIT: 0,
      FIGHT: 0,
      HIDE: 0,
      HEAL: 0,
      RUN: 0,
    };
    for (const ex of examples) counts[ex.action] = (counts[ex.action] ?? 0) + 1;
    return counts;
  }, [examples]);

  const statusText =
    mode === "AI_RUN"
      ? "AI is running now."
      : mode === "REVIEW"
      ? "Review mode."
      : "Training mode.";

  return (
    <div style={panel}>
      <div style={{ fontWeight: 900, fontSize: 20 }}>Status</div>
      <div style={{ marginTop: 8, fontSize: 14, opacity: 0.9 }}>{statusText}</div>

      {mode === "AI_RUN" ? (
        <div style={aiCard}>
          <div style={{ fontWeight: 900, fontSize: 18 }}>AI Running</div>
          <div style={{ marginTop: 6, fontSize: 13, opacity: 0.85 }}>
            The model is controlling the hero after your training phase.
          </div>
        </div>
      ) : null}

      {mode === "TRAINING" ? (
        <div style={dataCard}>
          <div style={{ fontSize: 12, opacity: 0.8 }}>Data fed to AI</div>
          <div style={{ marginTop: 4, fontSize: 34, fontWeight: 900 }}>{examplesCount}</div>
          <div style={{ fontSize: 12, opacity: 0.75 }}>examples</div>

          <div style={{ marginTop: 10, fontSize: 12, opacity: 0.85 }}>By action</div>
          <div style={{ marginTop: 6, display: "grid", gap: 4, fontSize: 13 }}>
            <CountRow label="UP" value={actionCounts.UP} />
            <CountRow label="DOWN" value={actionCounts.DOWN} />
            <CountRow label="LEFT" value={actionCounts.LEFT} />
            <CountRow label="RIGHT" value={actionCounts.RIGHT} />
            <CountRow label="ATTACK" value={actionCounts.ATTACK} />
            <CountRow label="WAIT" value={actionCounts.WAIT} />
            <CountRow label="FIGHT" value={actionCounts.FIGHT} />
            <CountRow label="HIDE" value={actionCounts.HIDE} />
            <CountRow label="HEAL" value={actionCounts.HEAL} />
            <CountRow label="RUN" value={actionCounts.RUN} />
          </div>
        </div>
      ) : null}

      <button onClick={clearExamples} style={{ width: "100%", marginTop: 12 }}>
        Clear Data
      </button>

      <button
        onClick={() => {
          resetForNewStudent();
          setStudentId(null);
        }}
        style={{ width: "100%", marginTop: 8 }}
      >
        Switch Student
      </button>
    </div>
  );
}

const panel: React.CSSProperties = {
  width: 340,
  padding: 16,
  borderRadius: 16,
  background: "#0b1020",
  border: "1px solid #1f2a44",
  color: "#e5e7eb",
};

const aiCard: React.CSSProperties = {
  marginTop: 12,
  padding: 14,
  borderRadius: 14,
  border: "1px solid #2b3c66",
  background: "linear-gradient(135deg, rgba(37,99,235,0.25), rgba(29,78,216,0.2))",
};

const dataCard: React.CSSProperties = {
  marginTop: 12,
  padding: 14,
  borderRadius: 14,
  border: "1px solid #334155",
  background: "rgba(15, 23, 42, 0.85)",
};

function CountRow({ label, value }: { label: string; value: number }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between" }}>
      <span>{label}</span>
      <span style={{ fontWeight: 800 }}>{value}</span>
    </div>
  );
}
