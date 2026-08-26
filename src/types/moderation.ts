export type ReportReason = "harassment" | "hate" | "sexual" | "violence" | "self_harm" | "spam" | "privacy" | "copyright" | "other";
export type ReportState = "open" | "triaged" | "actioned" | "dismissed";
export type ModerationDecision = "allow" | "limit" | "remove";

export type ModerationQueueItem = {
  id: string;
  reason: ReportReason;
  details: string | null;
  state: ReportState;
  createdAt: string;
  updatedAt: string;
  reporter: { handle: string; displayName: string } | null;
  target: {
    kind: "delivery" | "profile" | "prompt" | "submission";
    id: string;
    title: string;
    owner?: { handle: string; displayName: string } | null;
    context?: string | null;
    href?: string;
    state?: string | null;
    moderationLabels?: string[];
  };
};
