import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "Delivery — Say the line. Get judged.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          position: "relative",
          overflow: "hidden",
          background: "#070707",
          color: "#f5f2e8",
          fontFamily: "Arial, sans-serif",
          padding: 68,
        }}
      >
        <div style={{ position: "absolute", width: 500, height: 500, borderRadius: 999, right: -80, top: -200, background: "#ff4cc8", filter: "blur(110px)", opacity: 0.34 }} />
        <div style={{ position: "absolute", width: 560, height: 560, borderRadius: 999, left: -210, bottom: -330, background: "#5d7cff", filter: "blur(120px)", opacity: 0.38 }} />
        <div style={{ display: "flex", width: "100%", flexDirection: "column", justifyContent: "space-between", zIndex: 2 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16, fontSize: 30, fontWeight: 900 }}>
            <div style={{ width: 52, height: 52, borderRadius: 14, background: "#caff33", color: "#070707", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 32 }}>D</div>
            DELIVERY
          </div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ color: "#caff33", fontSize: 22, fontWeight: 900, letterSpacing: 6, marginBottom: 20 }}>THE VOICE PERFORMANCE GAME</div>
            <div style={{ fontSize: 90, lineHeight: 0.95, letterSpacing: -6, fontWeight: 950, maxWidth: 960 }}>SAY THE LINE.<br />GET JUDGED.</div>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 22, color: "#a7a5ac", fontWeight: 700 }}>
            <span>Commitment · Comedy · Accuracy · Chaos</span>
            <span style={{ color: "#ff4cc8" }}>YOUR MIC IS HOT →</span>
          </div>
        </div>
      </div>
    ),
    size,
  );
}
