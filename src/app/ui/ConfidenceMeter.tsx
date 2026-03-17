export default function ConfidenceMeter({ confidence }: { confidence: number }) {
    const pct = Math.round(confidence * 100);
    const bg =
      confidence >= 0.75 ? "#16a34a" :
      confidence >= 0.55 ? "#f59e0b" :
      "#ef4444";
  
    return (
      <div style={{ marginTop: 12 }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
          <strong>Confidence</strong>
          <span>{pct}%</span>
        </div>
        <div style={{ height: 12, background: "#111827", borderRadius: 999, overflow: "hidden" }}>
          <div style={{ width: `${pct}%`, height: "100%", background: bg }} />
        </div>
      </div>
    );
  }