import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import path from "path";

// GitHub Pages serves the site at https://<username>.github.io/<repo-name>/, so asset paths need that
// same prefix. When GitHub builds the site it tells us the repo name (GITHUB_REPOSITORY), so renaming the
// repo never breaks the site. On your own computer the prefix is just "/".
const repo = process.env.GITHUB_REPOSITORY?.split("/")[1];
const base = repo && !repo.endsWith(".github.io") ? `/${repo}/` : "/";

export default defineConfig({
  base,
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
        start_url: base,
        scope: base,
        icons: [
          { src: "icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "icon-512.png", sizes: "512x512", type: "image/png", purpose: "any maskable" }
        ]
      }
    })
  ]
});
