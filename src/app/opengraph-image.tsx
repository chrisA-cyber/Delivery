import { BrandMark } from "@/components/shell/brand-mark";
import { VISUAL_THEME } from "@/lib/visual-theme";
import { ImageResponse } from "next/og";
export const runtime = "edge";
export const alt = "Delivery — Same phrase. Different energy.";
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
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}><BrandMark size={44} /><span style={{ fontSize: 34, fontWeight: 700, letterSpacing: -2 }}>delivery</span></div>
          <span style={{ fontSize: 18, color: VISUAL_THEME.blue }}>
            PLAY SWITCH
          </span>
        </div>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            fontSize: 79,
            lineHeight: 1.03,
            fontWeight: 700,
            letterSpacing: -4,
          }}
        >
          <span>Same phrase.</span>
          <span style={{ color: VISUAL_THEME.accent }}>Different energy.</span>
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
          <span>One phrase. Five emotions or speeds. Your take.</span>
          <div style={{ display: "flex", alignItems: "center", gap: 12, color: VISUAL_THEME.blue }}><span>PLAY SWITCH</span><svg width="22" height="22" viewBox="0 0 24 24"><path d="M4 12h16M13 5l7 7-7 7" fill="none" stroke={VISUAL_THEME.blue} strokeWidth="2" /></svg></div>
        </div>
      </div>
    ),
    size,
  );
}
