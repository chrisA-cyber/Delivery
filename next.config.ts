import type { NextConfig } from "next";

function originOf(value: string | undefined): string | null {
  if (!value) return null;
  try { return new URL(value).origin; } catch { return null; }
}

const production = process.env.NODE_ENV === "production";
const secureDeployment = process.env.NEXT_PUBLIC_APP_URL?.startsWith("https://") ?? false;
const supabaseOrigin = originOf(process.env.NEXT_PUBLIC_SUPABASE_URL);
// Cloud selects regional endpoints at connection time. These fixed provider
// origins also work when server-only credentials are injected after the build.
const livekitSources = ["https://*.livekit.cloud", "wss://*.livekit.cloud"];
const connectSources = ["'self'", ...livekitSources, ...(supabaseOrigin ? [supabaseOrigin, supabaseOrigin.replace("https://", "wss://")] : []), ...(!production ? ["ws:", "http:"] : [])];
const contentSecurityPolicy = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${production ? "" : " 'unsafe-eval'"}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  "media-src 'self' blob: https:",
  `connect-src ${connectSources.join(" ")}`,
  "worker-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  ...(secureDeployment ? ["upgrade-insecure-requests"] : []),
].join("; ");

const nextConfig: NextConfig = {
  // Keep the interactive preview separate from production build artifacts.
  distDir: production ? ".next" : ".next-dev",
  poweredByHeader: false,
  devIndicators: false,
  compress: true,
  experimental: {
    optimizePackageImports: ["lucide-react", "framer-motion"],
  },
  headers: async () => [
    {
      // These media directories include an immutable clip version/hash.
      // Replays and retakes can reuse the reference without revalidating it.
      source: "/media/say-it-back/:clip/:version(v[0-9]+-[a-f0-9]{12})/:asset",
      headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }],
    },
    {
      source: "/(.*)",
      headers: [
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "X-Frame-Options", value: "DENY" },
        { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        { key: "Content-Security-Policy", value: contentSecurityPolicy },
        ...(secureDeployment ? [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" }] : []),
        {
          key: "Permissions-Policy",
          value: "camera=(), microphone=(self), geolocation=()",
        },
      ],
    },
    {
      source: "/roast-off/:path*",
      headers: [{ key: "Permissions-Policy", value: "camera=(self), microphone=(self), geolocation=()" }],
    },
  ],
};

export default nextConfig;
