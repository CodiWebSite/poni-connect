import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { VitePWA } from "vite-plugin-pwa";

// https://vitejs.dev/config/ — rebuild trigger
export default defineConfig(({ mode }) => ({
  build: {
    target: "es2015",
    chunkSizeWarningLimit: 1200,
  },

  server: {
    host: "::",
    port: 8080,
  },
  plugins: [
    react(),
    mode === "development" && componentTagger(),
    VitePWA({
      registerType: "prompt",
      injectRegister: null,
      devOptions: { enabled: false },
      includeAssets: ["logo-icmpp.png", "favicon.ico"],
      workbox: {
        maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
        navigateFallback: null,
        navigateFallbackDenylist: [/^\/~oauth/, /^\/kiosk/],
        // HTML is never stored anywhere: not precached, and no navigation
        // runtime cache either. A saved index.html pointing at files deleted by
        // the next publish is the classic "white screen after deploy" — and it
        // keeps coming back on every reopen until the network wins the race.
        // Always-fresh HTML removes that class of failure, and the platform
        // needs the network for its data anyway.
        globPatterns: ["**/*.{js,css,ico,png,svg,woff2}"],
        skipWaiting: false,
        clientsClaim: false,
        cleanupOutdatedCaches: true,
        // Push handlers live in the same worker that owns scope "/", so the
        // app worker never drops notifications when it replaces push-sw.js.
        importScripts: ["/push-sw.js"],
      },
      manifest: {
        id: "/",
        name: "ICMPP Intranet",
        lang: "ro",
        short_name: "ICMPP",
        description: "Platforma intranet a Institutului de Chimie Macromoleculară Petru Poni Iași",
        theme_color: "#1e40af",
        background_color: "#ffffff",
        display: "standalone",
        scope: "/",
        start_url: "/",
        categories: ["business", "productivity"],
        icons: [
          {
            src: "/pwa-192x192.png",
            sizes: "192x192",
            type: "image/png",
          },
          {
            src: "/pwa-512x512.png",
            sizes: "512x512",
            type: "image/png",
          },
          {
            src: "/pwa-512x512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },
    }),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
