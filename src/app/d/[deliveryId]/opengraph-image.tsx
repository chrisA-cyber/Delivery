import { VISUAL_THEME } from "@/lib/visual-theme";
import { ImageResponse } from "next/og";

import { getShareDelivery } from "@/lib/server/share";

export const alt = "A scored voice performance on Delivery";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const dynamic = "force-dynamic";

export default async function DeliveryOpenGraphImage({ params }: { params: Promise<{ deliveryId: string }> }) {
  const { deliveryId } = await params;
  let delivery = null;
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(deliveryId)) {
    try { delivery = await getShareDelivery(deliveryId, { includeAssets: false }); } catch { delivery = null; }
  }

  const score = delivery?.score ?? "—";
  const performer = delivery?.player?.displayName ?? "DELIVERY";
  const verdict = delivery?.verdictTag.replaceAll("_", " ") ?? "MIC CHECK PENDING";
  const line = delivery?.promptText ?? "This take is private or unavailable.";

  return new ImageResponse(
    <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", gap: 24, background: VISUAL_THEME.ink, color: VISUAL_THEME.paper, fontFamily: "Arial, sans-serif", padding: 40 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 26, fontWeight: 900 }}><span>DELIVERY</span><span style={{ color: VISUAL_THEME.blue, fontSize: 16 }}>{verdict}</span></div>
      <div style={{ display: "flex", flex: 1, gap: 32, alignItems: "center", borderRadius: 18, background: VISUAL_THEME.paper, color: VISUAL_THEME.ink, padding: 32 }}>
        <div style={{ display: "flex", flex: 1, flexDirection: "column" }}><div style={{ fontSize: 15, fontWeight: 700, color: VISUAL_THEME.paperMuted }}>{`${performer.toUpperCase()}${delivery ? " DELIVERED" : ""}`}</div><div style={{ marginTop: 20, fontSize: line.length > 140 ? 35 : 44, lineHeight: 1.12, letterSpacing: -1.5, fontWeight: 900 }}>{`“${line}”`}</div></div>
        <div style={{ display: "flex", width: 210, height: 230, flexShrink: 0, flexDirection: "column", alignItems: "center", justifyContent: "center", borderRadius: 14, background: VISUAL_THEME.amber }}><div style={{ fontSize: 100, lineHeight: 1, fontWeight: 900 }}>{score}</div><div style={{ marginTop: 12, fontSize: 20 }}>/ 100</div></div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", borderRadius: 14, padding: 24, background: VISUAL_THEME.blue, color: VISUAL_THEME.ink }}><div style={{ fontSize: 13, fontWeight: 700 }}>THE DIRECTION</div><div style={{ marginTop: 10, fontSize: 21, lineHeight: 1.3 }}>{delivery?.energy ?? "A private take stays private. Start your own round in Classic."}</div></div>
    </div>, size,
  );
}
