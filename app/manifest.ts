import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Spur VTU",
    short_name: "Spur VTU",
    description: "Airtime, data, cable TV and electricity from one wallet.",
    start_url: "/dashboard",
    display: "standalone",
    background_color: "#12343B",
    theme_color: "#12343B",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
  };
}
