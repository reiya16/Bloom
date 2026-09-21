import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import path from "path";

// ⚠️ Change "lift-log" below to match your actual GitHub repo name.
// GitHub Pages serves the repo at https://<username>.github.io/<repo-name>/
// so Vite's asset paths must be prefixed with that same base path.
export default defineConfig({
  base: "/gym-tracker-v2/",
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src")
    }
  },
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["icon-192.png", "icon-512.png", "apple-touch-icon.png"],
      manifest: {
        name: "Bloom",
        short_name: "Bloom",
        description: "Training and nutrition, coached to your goals",
        theme_color: "#FBF7F4",
        background_color: "#FBF7F4",
        display: "standalone",
        start_url: "/gym-tracker-v2/",
        scope: "/gym-tracker-v2/",
        icons: [
          { src: "icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "icon-512.png", sizes: "512x512", type: "image/png", purpose: "any maskable" }
        ]
      }
    })
  ]
});
