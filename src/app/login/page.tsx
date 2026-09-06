import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthPanel } from "@/components/auth/auth-panel";
import { getAuthAvailability } from "@/lib/server/auth-providers";

export const metadata: Metadata = {
  title: "Sign in",
  robots: { index: false, follow: false },
};

export default async function LoginPage() {
  const availability = await getAuthAvailability();
  return <main className="grid min-h-screen place-items-center px-4 pb-28 pt-28"><Suspense fallback={<div className="panel h-[600px] w-full max-w-lg animate-pulse" />}><AuthPanel {...availability} /></Suspense></main>;
}
