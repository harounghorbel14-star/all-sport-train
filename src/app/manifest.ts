import type { MetadataRoute } from "next";

/** Web app manifest: lets Android, iOS and desktop browsers install APEX FIT like an app. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "APEX FIT — AI Fitness & Calisthenics",
    short_name: "APEX FIT",
    description: "Calisthenics, strength and multisport training with lessons, workouts and progress tracking.",
    start_url: "/today?source=pwa",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#0a0c0d",
    theme_color: "#0a0c0d",
    categories: ["health", "fitness", "sports", "education"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Today's workout", url: "/today", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: "Sports", url: "/sports", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: "Saved for offline", url: "/offline", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
    ],
  };
}
