import GameCanvas from "../game/GameCanvas";
import RightPanel from "./ui/RightPanel";
import ReviewModal from "./ui/ReviewModal";
import OptionBoard from "./ui/OptionBoard";
import StartScreen from "./ui/StartScreen";
import TutorialBanner from "./ui/TutorialBanner";
import DeathModal from "./ui/DeathModal";

export default function GamePage() {
  return (
    <div style={{ minHeight: "100vh", background: "#050814", color: "#e5e7eb" }}>
      <StartScreen />

      <div style={{ maxWidth: 1280, margin: "0 auto", padding: 18 }}>
  <TutorialBanner />

  <div style={{ position: "relative" }}>
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "1fr 360px",
        gap: 16,
        alignItems: "start",
      }}
    >
      <GameCanvas />
      <RightPanel />
    </div>

    <OptionBoard />
  </div>

  <ReviewModal />
  <DeathModal />
</div>
    </div>
  );
}