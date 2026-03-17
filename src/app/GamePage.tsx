import GameCanvas from "../game/GameCanvas";
import RightPanel from "./ui/RightPanel";
import ReviewModal from "./ui/ReviewModal";
import OptionBoard from "./ui/OptionBoard";
import TutorialBanner from "./ui/TutorialBanner";
import DeathModal from "./ui/DeathModal";

export default function GamePage() {
  return (
    <div
      style={{
        height: "100vh",
        background: "#050814",
        color: "#e5e7eb",
        padding: 16,
        boxSizing: "border-box",
        display: "grid",
        gridTemplateRows: "auto 1fr",
        gap: 12,
      }}
    >
      <TutorialBanner />

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

      <ReviewModal />
      <DeathModal />
    </div>
  );
}
