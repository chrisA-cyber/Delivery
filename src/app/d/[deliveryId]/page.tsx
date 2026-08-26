import type { Metadata } from "next";

import { PublicDelivery } from "@/components/social/public-delivery";
import { getShareDelivery } from "@/lib/server/share";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ deliveryId: string }> }): Promise<Metadata> {
  const { deliveryId } = await params;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(deliveryId)) {
    return { title: "Take unavailable", robots: { index: false, follow: false } };
  }
  try {
    const delivery = await getShareDelivery(deliveryId, { includeAssets: false });
    if (!delivery) return { title: "Take unavailable", description: "This Delivery is private or unavailable.", robots: { index: false, follow: false } };
    const performer = delivery.player?.displayName ?? "A Delivery player";
    const title = `${delivery.score}/100 · ${delivery.verdictTag.replaceAll("_", " ")}`;
    const description = `${performer} delivered “${delivery.promptText.slice(0, 100)}” and got judged. Your mic next.`;
    const image = `/d/${deliveryId}/opengraph-image`;
    return {
      title,
      description,
      openGraph: { type: "article", title, description, images: [{ url: image, width: 1200, height: 630, alt: `${performer}'s Delivery score: ${delivery.score}` }] },
      twitter: { card: "summary_large_image", title, description, images: [image] },
    };
  } catch {
    return { title: "A Delivery just dropped", description: "Hear the take, inspect the score, then step up to the mic.", robots: { index: false, follow: false } };
  }
}

export default async function DeliveryPage({ params }: { params: Promise<{ deliveryId: string }> }) {
  const { deliveryId } = await params;
  return <main className="min-h-screen px-3 pb-28 pt-24 sm:px-6 sm:pt-28"><PublicDelivery deliveryId={deliveryId} /></main>;
}
