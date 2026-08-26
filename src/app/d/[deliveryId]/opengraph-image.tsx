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
    <div style={{ width: "100%", height: "100%", display: "flex", position: "relative", overflow: "hidden", background: "#070707", color: "#f5f2e8", fontFamily: "Arial, sans-serif", padding: 64 }}>
      <div style={{ position: "absolute", width: 520, height: 520, borderRadius: 999, right: -120, top: -220, background: "#ff4cc8", filter: "blur(110px)", opacity: .35 }} />
      <div style={{ position: "absolute", width: 560, height: 560, borderRadius: 999, left: -220, bottom: -360, background: "#5d7cff", filter: "blur(120px)", opacity: .38 }} />
      <div style={{ display: "flex", width: "100%", flexDirection: "column", justifyContent: "space-between", zIndex: 2 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14, fontSize: 26, fontWeight: 900 }}><div style={{ width: 48, height: 48, borderRadius: 14, background: "#caff33", color: "#070707", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 30 }}>D</div>DELIVERY</div>
          <div style={{ color: "#caff33", fontSize: 20, fontWeight: 900, letterSpacing: 4 }}>{verdict}</div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 48 }}>
          <div style={{ width: 224, height: 224, flexShrink: 0, borderRadius: 999, border: "14px solid #caff33", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: "#101010", boxShadow: "0 0 80px rgba(202,255,51,.22)" }}><div style={{ fontSize: 94, lineHeight: 1, fontWeight: 950 }}>{score}</div><div style={{ marginTop: 8, color: "#8b8b92", fontSize: 16, letterSpacing: 4, fontWeight: 900 }}>/ 100</div></div>
          <div style={{ display: "flex", flexDirection: "column", maxWidth: 760 }}><div style={{ color: "#ff4cc8", fontSize: 20, fontWeight: 900, letterSpacing: 4 }}>{performer.toUpperCase()} DELIVERED</div><div style={{ marginTop: 18, fontSize: 54, lineHeight: 1.05, letterSpacing: -2, fontWeight: 950 }}>“{line.slice(0, 150)}”</div></div>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", color: "#9c9ba2", fontSize: 20, fontWeight: 700 }}><span>Commitment · Comedy · Accuracy · Chaos</span><span style={{ color: "#caff33" }}>YOUR MIC NEXT →</span></div>
      </div>
    </div>,
    size,
  );
}
