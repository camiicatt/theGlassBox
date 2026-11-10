import { useEffect, useRef } from "react";
import { createGame } from "../phaser/createGame";
export default function GameCanvas() {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const game = createGame(containerRef.current);
    return () => game.destroy(true);
  }, []);

  return (
    <div
      ref={containerRef}
      style={{
        width: "100%",
        height: "100%",
        minHeight: 0,
        borderRadius: 16,
        overflow: "hidden",
        border: "2px solid #9b2d2d",
        background: "#0e0a06",
      }}
    />
  );
}
