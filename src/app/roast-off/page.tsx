import type { Metadata } from "next";
import { RoastLobby } from "@/components/roast/roast-lobby";
import "./roast.css";

export const metadata: Metadata = {
  title: "Roast Off · Take the mic. Take the heat.",
  description: "A live roast stage. Watch the battle, hang out with the crowd, or queue for your turn. Adults 18+ only.",
  referrer: "no-referrer",
};

export default function RoastOffPage() {
  return <RoastLobby />;
}
