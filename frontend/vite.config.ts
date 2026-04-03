import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  // Make built assets paths relative (helps if someone opens dist/index.html directly).
  base: "./",
  plugins: [react()],
  resolve: {
    alias: {
      // So imports like "@/lib/api" point to "frontend/client/lib/api.ts".
      "@": path.resolve(__dirname, "./client"),
    },
  },
  server: {
    port: 5173,
    strictPort: true,
  },
});

