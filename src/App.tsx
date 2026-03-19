import GamePage from "./app/GamePage";
import NamePage from "./app/NamePage";
import { useGameStore } from "./app/store/useGameStore";

export default function App() {
  const studentId = useGameStore((s) => s.studentId);
  return studentId ? <GamePage /> : <NamePage />;
}
