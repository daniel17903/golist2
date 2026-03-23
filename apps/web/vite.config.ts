import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

const apiBaseUrl = process.env.API_BASE_URL ?? "";

console.info(`[web-build] Configured API_BASE_URL=${apiBaseUrl || "<offline-only>"}`);

export default defineConfig({
  build: {
    minify: "esbuild",
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("node_modules/react/") ||
              id.includes("node_modules/react-dom/") ||
              id.includes("node_modules/zustand/") ||
              id.includes("node_modules/dexie/")) {
            return "vendor";
          }
        },
      },
    },
  },
  define: {
    __APP_VERSION__: JSON.stringify(process.env.npm_package_version ?? "dev"),
    __API_BASE_URL__: JSON.stringify(apiBaseUrl),
    __API_TIMEOUT_MS__: JSON.stringify(process.env.API_TIMEOUT_MS ?? "15000"),
    __ENVIRONMENT__: JSON.stringify(process.env.ENVIRONMENT ?? "development"),
  },
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.svg", "favicon.ico", "favicon-96x96.png", "apple-touch-icon.png", "web-app-manifest-192x192.png", "web-app-manifest-512x512.png", "icons/*.svg", "icons/*.png"],
      manifest: {
        name: "GoList",
        short_name: "GoList",
        description: "Smart grocery lists with list-specific suggestions and category sorting.",
        categories: ["shopping", "productivity", "utilities"],
        theme_color: "#0b3d5c",
        background_color: "#404e55",
        display: "standalone",
        start_url: "/",
        scope: "/",
        icons: [
          {
            src: "/web-app-manifest-192x192.png",
            sizes: "192x192",
            type: "image/png",
            purpose: "any",
          },
          {
            src: "/web-app-manifest-512x512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any",
          },
          {
            src: "/web-app-manifest-192x192.png",
            sizes: "192x192",
            type: "image/png",
            purpose: "maskable",
          },
          {
            src: "/web-app-manifest-512x512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,ico,png,svg,jpg,jpeg,webp,gif}"],
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
