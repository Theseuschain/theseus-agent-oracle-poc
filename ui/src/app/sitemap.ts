import type { MetadataRoute } from "next";

const BASE_URL = "https://demo-agents.theseus.network";
const LAST_MODIFIED = "2026-05-11";

const ROUTES: Array<{ path: string; priority: number }> = [
  { path: "/", priority: 1.0 },
  { path: "/aave", priority: 0.9 },
  { path: "/terra", priority: 0.9 },
  { path: "/adjudicate", priority: 0.9 },
  { path: "/bridge", priority: 0.9 },
  { path: "/governance", priority: 0.9 },
  { path: "/aviation", priority: 0.9 },
  { path: "/fund", priority: 0.9 },
  { path: "/launch-sniper", priority: 0.85 },
];

export default function sitemap(): MetadataRoute.Sitemap {
  return ROUTES.map(({ path, priority }) => ({
    url: `${BASE_URL}${path}`,
    lastModified: LAST_MODIFIED,
    changeFrequency: "weekly",
    priority,
  }));
}
