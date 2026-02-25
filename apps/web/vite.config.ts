import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

const apiBaseUrl = process.env.API_BASE_URL ?? "http://localhost:3000";

if (process.env.VERCEL === "1") {
  console.info(`[web-build] Configured API_BASE_URL=${apiBaseUrl}`);
}

export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(process.env.npm_package_version ?? "dev"),
    __API_BASE_URL__: JSON.stringify(apiBaseUrl),
    __API_TIMEOUT_MS__: JSON.stringify(process.env.API_TIMEOUT_MS ?? "15000"),
    __IS_VERCEL_PRODUCTION__: JSON.stringify(process.env.VERCEL === "1" && process.env.VERCEL_ENV === "production"),
    __IS_VERCEL_NON_PRODUCTION__: JSON.stringify(process.env.VERCEL === "1" && process.env.VERCEL_ENV !== "production"),
  },
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.png", "icons/*.svg", "icons/icon.png"],
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
            src: "/favicon.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any maskable",
          },
          {
            src: "/icons/icon.png",
            sizes: "512x512",
            type: "image/png",
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
