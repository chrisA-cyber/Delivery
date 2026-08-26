import type { Metadata } from "next";

import { ModerationQueue } from "@/components/moderation/moderation-queue";
import { PageShell } from "@/components/shell/page-shell";

export const metadata: Metadata = {
  title: "Moderation room",
  robots: { index: false, follow: false },
};

export default function ModerationPage() {
  return <PageShell eyebrow="Trust crew only" title="Keep the stage safe." description="Review reports, contain harmful content, and leave an audit trail for every decision."><ModerationQueue /></PageShell>;
}
