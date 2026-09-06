import type { Metadata } from "next";
import { PasswordResetPanel } from "@/components/auth/password-reset-panel";
import { getAuthAvailability } from "@/lib/server/auth-providers";
import { safeInternalAppPath } from "@/lib/server/redirects";

export const metadata: Metadata = { title: "Reset password", robots: { index: false, follow: false } };

export default async function ResetPasswordPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const [{ next: requested }, availability] = await Promise.all([searchParams, getAuthAvailability()]);
  const next = safeInternalAppPath(requested, process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000");
  return <main className="grid min-h-screen place-items-center px-4 pb-28 pt-28"><PasswordResetPanel next={next} emailReady={availability.emailReady} /></main>;
}
