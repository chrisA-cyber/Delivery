import type { Metadata } from "next";
import { DeliveryFeed } from "@/components/social/delivery-feed";
import { PageShell } from "@/components/shell/page-shell";

export const metadata: Metadata = { title: "The feed" };

export default function FeedPage() {
  return <PageShell eyebrow="People are making choices" title="Fresh deliveries." description="Great takes, magnificent failures, and the exact moment someone realized the mic was still on."><DeliveryFeed /></PageShell>;
}
