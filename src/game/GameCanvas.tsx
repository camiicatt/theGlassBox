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
    aspectRatio: "4 / 3",     // keeps it tall enough to look like a game
    borderRadius: 16,
    overflow: "hidden",
    border: "1px solid #1f2a44",
    background: "#050814",
  }}
/>
  );
}