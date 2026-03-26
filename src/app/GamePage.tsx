import GameCanvas from "../game/GameCanvas";
import RightPanel from "./ui/HeroBrainPanel";
import ReviewModal from "./ui/ReviewModal";
import OptionBoard from "./ui/OptionBoard";
import TutorialBanner from "./ui/TutorialBanner";
import DeathModal from "./ui/DeathModal";
import IntroModal from "./ui/IntroModal";
import { useGameStore } from "./store/useGameStore";

export default function GamePage() {
  const mode = useGameStore((s) => s.mode);

  return (
    <div
      style={{
        height: "100vh",
        background: mode === "AI_RUN" ? "#ff0000ff" : "#050814",
        color: mode === "AI_RUN" ? "#0c1a2e" : "#e5e7eb",
        padding: 16,
        boxSizing: "border-box",
        display: "grid",
        gridTemplateRows: "auto 1fr",
        gap: 12,
      }}
    >
      <TutorialBanner />
      {mode === "AI_RUN" && (
        <div style={{ textAlign: "center", fontSize: 28, fontWeight: 900, color: "#fff", letterSpacing: 2, textTransform: "uppercase", textShadow: "0 2px 8px rgba(0,0,0,0.4)" }}>
          🤖 AI Turn
        </div>
      )}

      <div style={{ position: "relative", minHeight: 0 }}>
        <div
          style={{
            height: "100%",
            display: "grid",
            gridTemplateColumns: "1fr 360px",
            gap: 16,
            alignItems: "stretch",
            minHeight: 0,
          }}
        >
          <GameCanvas />
          <RightPanel />
        </div>

        <OptionBoard />
      </div>


      <IntroModal />
      <ReviewModal />
      <DeathModal />
    </div>
  );
}
