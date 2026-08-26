import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthPanel } from "@/components/auth/auth-panel";

export const metadata: Metadata = {
  title: "Sign in",
  robots: { index: false, follow: false },
};

export default function LoginPage() {
  return <main className="grid min-h-screen place-items-center bg-[radial-gradient(circle_at_50%_15%,rgba(93,124,255,.2),transparent_35rem)] px-4 pb-16 pt-24"><Suspense fallback={<div className="panel h-[600px] w-full max-w-md animate-pulse" />}><AuthPanel /></Suspense></main>;
}
