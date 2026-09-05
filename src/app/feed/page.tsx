import type { Metadata } from "next";
import { DeliveryFeed } from "@/components/social/delivery-feed";
import { PageShell } from "@/components/shell/page-shell";

export const metadata: Metadata = { title: "The feed" };

export default function FeedPage() {
  return <PageShell eyebrow="People are making choices" title="Fresh deliveries." description="Public performances shared by their players. Hear the delivery, react to the bit, and find your next favorite performer."><DeliveryFeed /></PageShell>;
}
