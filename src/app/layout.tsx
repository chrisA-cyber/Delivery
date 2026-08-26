import type { Metadata, Viewport } from "next";
import "./globals.css";
import { AppProvider } from "@/components/providers/app-provider";
import { MobileDock } from "@/components/shell/mobile-dock";
import { SiteHeader } from "@/components/shell/site-header";
import { getAppUrl } from "@/lib/utils";

const appUrl = getAppUrl();

export const metadata: Metadata = {
  metadataBase: new URL(appUrl),
  title: {
    default: "Delivery — Say the line. Get judged.",
    template: "%s · Delivery",
  },
  description: "The voice performance game where you get a line, deliver it, and get judged.",
  applicationName: "Delivery",
  keywords: ["voice game", "party game", "performance", "recording", "social game"],
  authors: [{ name: "Delivery" }],
  creator: "Delivery",
  openGraph: {
    type: "website",
    siteName: "Delivery",
    title: "Delivery — Say the line. Get judged.",
    description: "A microphone, a line, and one shot at main-character energy.",
    url: appUrl,
    images: [{ url: "/opengraph-image", width: 1200, height: 630, alt: "Delivery voice performance game" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Delivery — Say the line. Get judged.",
    description: "A microphone, a line, and one shot at main-character energy.",
    images: ["/opengraph-image"],
  },
  icons: {
    icon: [{ url: "/icon.svg", type: "image/svg+xml" }, { url: "/icon-192.png", sizes: "192x192", type: "image/png" }],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
  manifest: "/manifest.webmanifest",
};

export const viewport: Viewport = {
  themeColor: "#070707",
  colorScheme: "dark",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="noise antialiased">
        <AppProvider>
          <SiteHeader />
          {children}
          <MobileDock />
        </AppProvider>
      </body>
    </html>
  );
}
