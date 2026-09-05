import type { Metadata } from "next";
import { DailyDrop } from "@/components/game/daily-drop";

export const metadata: Metadata = { title: "Daily Drop" };
export const dynamic = "force-dynamic";

export default function DailyPage() {
  return (
    <main className="game-main">
      <DailyDrop />
    </main>
  );
}
