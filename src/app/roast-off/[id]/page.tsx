import type { Metadata } from "next";
import { RoastRoom } from "@/components/roast/roast-room";
import "../roast.css";

export const metadata: Metadata = {
  title: "Roast Off · Live stage",
  description: "Two performers. One crowd. You call it. Adults 18+ only.",
  referrer: "no-referrer",
  robots: { index: false, follow: false },
};

export default async function RoastRoomPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ invite?: string }> }) {
  const [{ id }, { invite }] = await Promise.all([params, searchParams]);
  return <RoastRoom id={id} inviteToken={invite} />;
}
