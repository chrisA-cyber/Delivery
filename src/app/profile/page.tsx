import type { Metadata } from "next";
import { ProfileView } from "@/components/profile/profile-view";

export const metadata: Metadata = {
  title: "Your profile",
  robots: { index: false, follow: false },
};

export default function ProfilePage() {
  return <main className="min-h-screen px-4 pb-28 pt-28 sm:px-6 lg:px-8"><div className="mx-auto max-w-6xl"><ProfileView /></div></main>;
}
