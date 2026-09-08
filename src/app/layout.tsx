import type { Metadata, Viewport } from "next";
import "@fontsource/barlow-condensed/700.css";
import "@fontsource/dm-sans/400.css";
import "@fontsource/dm-sans/500.css";
import "@fontsource/dm-sans/700.css";
import "./globals.css";
import { AppProvider } from "@/components/providers/app-provider";
import { MobileDock } from "@/components/shell/mobile-dock";
import { SiteHeader } from "@/components/shell/site-header";
import { getAppUrl } from "@/lib/utils";

const appUrl = getAppUrl();

export const metadata: Metadata = {
  metadataBase: new URL(appUrl),
  title: {
    default: "Delivery — Same phrase. Different energy.",
    template: "%s · Delivery",
  },
  description:
    "Play Switch: one phrase, five emotions or speeds. Record with an avatar or camera, replay your take, and challenge a friend.",
  applicationName: "Delivery",
  keywords: [
    "voice game",
    "party game",
    "performance",
    "recording",
    "social game",
  ],
  authors: [{ name: "Delivery" }],
  creator: "Delivery",
  openGraph: {
    type: "website",
    siteName: "Delivery",
    title: "Delivery — Same phrase. Different energy.",
    description: "One phrase. Five emotions or speeds. Your take.",
    url: appUrl,
    images: [
      {
        url: "/opengraph-image",
        width: 1200,
        height: 630,
        alt: "Delivery — Switch performance game",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Delivery — Same phrase. Different energy.",
    description: "One phrase. Five emotions or speeds. Your take.",
    images: ["/opengraph-image"],
  },
  icons: {
    icon: [
      { url: "/icon.svg", type: "image/svg+xml" },
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
    ],
    apple: [
      { url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
  },
  manifest: "/manifest.webmanifest",
};

export const viewport: Viewport = {
  themeColor: "#10141f",
  colorScheme: "dark",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="noise antialiased">
        <AppProvider>
          <a href="#main-content" className="skip-link">
            Skip to content
          </a>
          <SiteHeader />
          <div id="main-content" tabIndex={-1}>
            {children}
          </div>
          <MobileDock />
        </AppProvider>
      </body>
    </html>
  );
}
