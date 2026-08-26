import type { Metadata } from "next";

import { PublicProfileView } from "@/components/profile/public-profile-view";

export const metadata: Metadata = { title: "Performer profile" };
export const dynamic = "force-dynamic";

export default async function PublicProfilePage({ params }: { params: Promise<{ handle: string }> }) {
  const { handle } = await params;
  return <main className="min-h-screen px-4 pb-28 pt-28 sm:px-6 lg:px-8"><PublicProfileView handle={handle} /></main>;
}
