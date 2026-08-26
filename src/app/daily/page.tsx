import type { Metadata } from "next";
import { DailyDrop } from "@/components/game/daily-drop";

export const metadata: Metadata = { title: "Daily Drop" };
export const dynamic = "force-dynamic";

export default function DailyPage() {
  return (
    <main className="min-h-screen px-3 pb-10 pt-24 sm:px-6 sm:pt-28 lg:pt-20">
      <DailyDrop />
    </main>
  );
}
