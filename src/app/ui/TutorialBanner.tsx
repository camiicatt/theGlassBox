import { useGameStore } from "../ui/store/useGameStore";

export default function TutorialBanner() {
  const mode = useGameStore((s) => s.mode);
  const studentId = useGameStore((s) => s.studentId);

  if (!studentId) return <div style={bar}>Enter your name to begin.</div>;

  const message =
    mode === "TRAINING"
      ? "You have entered a dungeon… you must teach your hero to survive!"
      : mode === "AI_RUN"
      ? "Now watch the robot try on its own. Confidence shows how sure it is."
      : "Help the robot learn: fix its low-confidence mistakes.";

  return (
    <div style={bar}>
      <div style={{ fontWeight: 900 }}>Player: {studentId}</div>
      <div style={{ opacity: 0.9 }}>{message}</div>
    </div>
  );
}

const bar: React.CSSProperties = {
  padding: "10px 14px",
  borderRadius: 16,
  border: "1px solid #1f2a44",
  background: "linear-gradient(135deg, rgba(17,26,51,0.95), rgba(11,16,32,0.95))",
  color: "#e5e7eb",
  display: "flex",
  justifyContent: "space-between",
  gap: 16,
  alignItems: "center",
  marginBottom: 12,
};