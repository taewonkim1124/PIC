import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "PIC QR Check-in",
    short_name: "PIC Check-in",
    description: "PIC member QR check-in app",
    start_url: "/",
    display: "standalone",
    background_color: "#f4f7fb",
    theme_color: "#172554",
    orientation: "portrait",
    icons: [
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "maskable",
      },
    ],
  };
}
