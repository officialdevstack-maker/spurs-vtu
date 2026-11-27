import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/seo";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: new URL("/", SITE_URL).toString(),
      changeFrequency: "weekly",
      priority: 1,
    },
    {
      url: new URL("/services", SITE_URL).toString(),
      changeFrequency: "monthly",
      priority: 0.8,
    },
  ];
}
