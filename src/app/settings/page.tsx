import type { Metadata } from "next";
import { SettingsPanel } from "@/components/settings/settings-panel";
import { PageShell } from "@/components/shell/page-shell";

export const metadata: Metadata = {
  title: "Settings",
  robots: { index: false, follow: false },
};

export default function SettingsPage() { return <PageShell eyebrow="Control room" title="Your settings." description="Audio, motion, privacy, and the things that stop an app from being annoying."><SettingsPanel /></PageShell>; }
