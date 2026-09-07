import { VISUAL_THEME } from "@/lib/visual-theme";
import { ImageResponse } from "next/og";
export const runtime = "edge";
export const alt = "Delivery — Terrible lines. Incredible commitment.";
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
          flexDirection: "column",
          justifyContent: "space-between",
          background: VISUAL_THEME.ink,
          color: VISUAL_THEME.paper,
          padding: 58,
          fontFamily: "Arial, sans-serif",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <span style={{ fontSize: 30, fontWeight: 900 }}>DELIVERY</span>
          <span style={{ fontSize: 18, color: VISUAL_THEME.blue }}>
            THE VOICE PERFORMANCE GAME
          </span>
        </div>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            fontSize: 79,
            lineHeight: 1.03,
            fontWeight: 900,
            letterSpacing: -4,
          }}
        >
          <span>Terrible lines.</span>
          <span style={{ color: VISUAL_THEME.amber }}>Incredible commitment.</span>
        </div>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            borderTop: `1px solid ${VISUAL_THEME.border}`,
            paddingTop: 24,
            fontSize: 22,
          }}
        >
          <span>One line. One direction. Your interpretation.</span>
          <span style={{ color: VISUAL_THEME.blue }}>PLAY CLASSIC →</span>
        </div>
      </div>
    ),
    size,
  );
}
