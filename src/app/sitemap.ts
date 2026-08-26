import type { MetadataRoute } from "next";
import { getAppUrl } from "@/lib/utils";

export default function sitemap(): MetadataRoute.Sitemap {
  const paths = ["", "/play", "/daily", "/discover", "/feed", "/leaderboard", "/pricing", "/stream", "/guidelines"];
  return paths.map((path) => ({
    url: `${getAppUrl()}${path}`,
    lastModified: new Date(),
    changeFrequency: path === "/daily" || path === "/feed" ? "daily" : "weekly",
    priority: path === "" ? 1 : path === "/play" ? 0.95 : 0.7,
  }));
}
