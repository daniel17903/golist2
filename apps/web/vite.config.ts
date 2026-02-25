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
      includeAssets: ["favicon.svg", "favicon.ico", "favicon-96x96.png", "apple-touch-icon.png", "web-app-manifest-192x192.png", "web-app-manifest-512x512.png", "icons/*.svg"],
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
            src: "/web-app-manifest-192x192.png",
            sizes: "192x192",
            type: "image/png",
          },
          {
            src: "/web-app-manifest-512x512.png",
            sizes: "512x512",
            type: "image/png",
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
