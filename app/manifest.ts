import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "PIC QR 체크인",
    short_name: "PIC 체크인",
    description: "PIC 멤버 QR 체크인 앱",
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
