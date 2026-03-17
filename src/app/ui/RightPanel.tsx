import { useMemo } from "react";
import { useGameStore } from "./store/useGameStore";

export default function RightPanel() {
  const mode = useGameStore((s) => s.mode);
  const setMode = useGameStore((s) => s.setMode);

  const examples = useGameStore((s) => s.examples); // <-- needed for counts
  const examplesCount = examples.length;
  const clearExamples = useGameStore((s) => s.clearExamples);

  const pred = useGameStore((s) => s.prediction);

  const setStudentId = useGameStore((s) => s.setStudentId);
  const resetForNewStudent = useGameStore((s) => s.resetForNewStudent);

  const confidence = pred?.confidence ?? 0;
  const pct = Math.round(confidence * 100);

  const top3 = useMemo(() => {
    if (!pred?.probs) return [];
    return Object.entries(pred.probs)
      .sort((a, b) => (b[1] as number) - (a[1] as number))
      .slice(0, 3);
  }, [pred]);

  // Safe prob reader (handles missing keys)
  const probPct = (action: string) => {
    const p = (pred?.probs as any)?.[action];
    const val = typeof p === "number" ? p : 0;
    return Math.max(0, Math.min(100, Math.round(val * 100)));
  };

  // NEW: global taught counts (so it doesn't feel like it "reset")
  const taughtCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const ex of examples) {
      const a = ex.action as unknown as string;
      counts[a] = (counts[a] ?? 0) + 1;
    }
    return counts;
  }, [examples]);

  const count = (a: string) => taughtCounts[a] ?? 0;

  return (
    <div
      style={{
        width: 340,
        padding: 16,
        borderRadius: 16,
        background: "#0b1020",
        border: "1px solid #1f2a44",
        color: "#e5e7eb",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ fontWeight: 900 }}> HERO BRAIN </div>
        <div style={{ fontSize: 12, opacity: 0.85 }}>Mode: {mode}</div>
      </div>

      {/* Student controls */}
      <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
        <button
          onClick={() => {
            resetForNewStudent();
            setStudentId(null);
          }}
          style={{ width: "100%" }}
        >
          Switch Student
        </button>
      </div>

      {/* Mode buttons */}
      <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
        <button onClick={() => setMode("TRAINING")}>Training</button>
        <button onClick={() => setMode("AI_RUN")}>Run AI</button>
        <button onClick={() => setMode("REVIEW")}>Review</button>
      </div>

      {/* Stop AI button */}
      {mode === "AI_RUN" && (
        <button onClick={() => setMode("TRAINING")} style={{ marginTop: 10, width: "100%" }}>
          ⏹ Stop AI
        </button>
      )}

      {/* Confidence meter */}
      <div style={{ marginTop: 14 }}>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, opacity: 0.85 }}>
          <span>Confidence</span>
          <span style={{ fontWeight: 900 }}>{pct}%</span>
        </div>

        <div
          style={{
            height: 12,
            borderRadius: 999,
            overflow: "hidden",
            background: "#0b1226",
            border: "1px solid #1f2a44",
            marginTop: 6,
          }}
        >
          <div
            style={{
              width: `${pct}%`,
              height: "100%",
              background: confidence >= 0.75 ? "#22c55e" : confidence >= 0.55 ? "#f59e0b" : "#ef4444",
            }}
          />
        </div>

        <div style={{ marginTop: 8, fontSize: 12, opacity: 0.8 }}>
          {confidence >= 0.75 ? "😎 Confident" : confidence >= 0.55 ? "🤔 Unsure" : "😵 Confused"}
        </div>
      </div>

      {/* Survival chances */}
      <div style={{ marginTop: 14 }}>
        <div style={{ fontSize: 12, opacity: 0.85, marginBottom: 6 }}>Survival chances (right now)</div>

        <div style={{ display: "grid", gap: 6 }}>
          <Row label="❤️ HEAL" value={`${probPct("HEAL")}%`} />
          <Row label="🫥 HIDE" value={`${probPct("HIDE")}%`} />
          <Row label="💨 RUN" value={`${probPct("RUN")}%`} />
          <Row label="⚔ FIGHT" value={`${probPct("FIGHT")}%`} />
        </div>

        <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
  <button
    style={{ flex: 1 }}
    onClick={() => useGameStore.getState().setPendingAction("HEAL")}
    title="Teach the AI: Heal in this situation"
  >
    ❤️ Teach Heal
  </button>

  <button
    style={{ flex: 1 }}
    onClick={() => useGameStore.getState().setPendingAction("HIDE")}
    title="Teach the AI: Hide in this situation"
  >
    🫥 Teach Hide
  </button>
</div>

        {/* NEW: Global taught counts */}
        <div style={{ marginTop: 10, fontSize: 12, opacity: 0.9 }}>
          <div style={{ fontWeight: 900, marginBottom: 6 }}>You taught (total)</div>
          <div style={{ display: "grid", gap: 4 }}>
            <Row label="❤️ HEAL" value={`${count("HEAL")}`} />
            <Row label="🫥 HIDE" value={`${count("HIDE")}`} />
            <Row label="💨 RUN" value={`${count("RUN")}`} />
            <Row label="⚔ FIGHT" value={`${count("FIGHT")}`} />
          </div>
        </div>

        <div style={{ marginTop: 8, fontSize: 12, opacity: 0.75 }}>
          If HEAL/HIDE show low %, try teaching them when HP is low (that’s when they’re useful).
        </div>
      </div>

      {/* Top actions */}
      <div style={{ marginTop: 14 }}>
        <div style={{ fontSize: 12, opacity: 0.85, marginBottom: 6 }}>AI thinks:</div>
        {top3.length === 0 ? (
          <div style={{ fontSize: 12, opacity: 0.8 }}>
            No predictions yet — collect examples in Training.
          </div>
        ) : (
          top3.map(([a, p]) => (
            <div key={a} style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ fontWeight: 700 }}>{a}</span>
              <span>{Math.round((p as number) * 100)}%</span>
            </div>
          ))
        )}
      </div>

      {/* Training data */}
      <div style={{ marginTop: 14 }}>
        <div style={{ fontSize: 12, opacity: 0.85 }}>Training data</div>
        <div style={{ fontWeight: 900, fontSize: 18 }}>{examplesCount} examples</div>
        <button onClick={clearExamples} style={{ marginTop: 8, width: "100%" }}>
          🧹 Clear Examples
        </button>
      </div>

      <div style={{ marginTop: 12, fontSize: 12, opacity: 0.75 }}>
        Tip: click the dungeon canvas so WASD controls work.
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between" }}>
      <span style={{ fontWeight: 700 }}>{label}</span>
      <span>{value}</span>
    </div>
  );
}