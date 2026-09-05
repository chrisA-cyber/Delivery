import type { Metadata } from "next";
import { SettingsPanel } from "@/components/settings/settings-panel";
import { PageShell } from "@/components/shell/page-shell";

export const metadata: Metadata = {
  title: "Settings",
  robots: { index: false, follow: false },
};

export default function SettingsPage() { return <PageShell eyebrow="Control room" title="Your settings." description="Set your content intensity, playback, motion, and privacy. Manage your profile and account in one place."><SettingsPanel /></PageShell>; }
