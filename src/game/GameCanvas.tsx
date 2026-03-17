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
        border: "1px solid #1f2a44",
        background: "#050814",
      }}
    />
  );
}
