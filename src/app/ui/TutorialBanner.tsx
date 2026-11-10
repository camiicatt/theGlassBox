import { useGameStore } from "../store/useGameStore";

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
  borderRadius: 12,
  border: "1px solid #9b2d2d",
  background:
    "linear-gradient(135deg, rgba(34,30,29,0.96), rgba(22,19,18,0.96))",
  color: "#e7ddd5",
  fontFamily: `"Cinzel", "Trajan Pro", Georgia, serif`,
  display: "flex",
  justifyContent: "space-between",
  gap: 16,
  alignItems: "center",
  marginBottom: 12,
};