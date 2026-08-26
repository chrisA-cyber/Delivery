import type { MetadataRoute } from "next";
import { getAppUrl } from "@/lib/utils";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/api/", "/settings", "/profile", "/login", "/moderation", "/stream/stage", "/challenge/"],
    },
    sitemap: `${getAppUrl()}/sitemap.xml`,
  };
}
