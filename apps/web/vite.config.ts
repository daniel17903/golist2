import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(process.env.npm_package_version ?? "dev"),
    __API_BASE_URL__: JSON.stringify(process.env.API_BASE_URL ?? "http://localhost:3000"),
    __API_TIMEOUT_MS__: JSON.stringify(process.env.API_TIMEOUT_MS ?? "4000"),
  },
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.svg", "icons/*.svg"],
      manifest: {
        name: "GoList",
        short_name: "GoList",
        description: "Smart grocery lists with list-specific suggestions and category sorting.",
        categories: ["shopping", "productivity", "utilities"],
        theme_color: "#0b3d5c",
        background_color: "#cfe8d6",
        display: "standalone",
        start_url: "/",
        id: "/",
        scope: "/",
        icons: [
          {
            src: "/favicon.svg",
            sizes: "any",
            type: "image/svg+xml",
            purpose: "any maskable",
          },
          {
            src: "/icons/icon_new.svg",
            sizes: "any",
            type: "image/svg+xml",
            purpose: "any maskable",
          },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{ico,png,svg,jpg,jpeg,webp,gif}"],
        runtimeCaching: [
          {
            urlPattern: ({ request }) => request.destination === "image",
            handler: "CacheFirst",
            options: {
              cacheName: "images",
              expiration: {
                maxEntries: 200,
                maxAgeSeconds: 60 * 60 * 24 * 30,
              },
            },
          },
        ],
      },
    }),
  ],
});
