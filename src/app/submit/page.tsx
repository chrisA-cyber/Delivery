import type { Metadata } from "next";

import { SubmissionForm } from "@/components/discover/submission-form";
import { PageShell } from "@/components/shell/page-shell";

export const metadata: Metadata = { title: "Submit a line", description: "Pitch an original line to the Delivery editorial queue." };

export default function SubmitPage() {
  return <PageShell eyebrow="Community writers room" title="Put a line in the game." description="Submit an original sentence with clip potential. Every line gets an automated safety pass and human editorial review before publication."><SubmissionForm /></PageShell>;
}
