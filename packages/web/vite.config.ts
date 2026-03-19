import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  base: "/",
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@shared": path.resolve(__dirname, "../../shared"),
    },
  },
  server: {
    proxy: {
      "/api": {
        target: "http://raspberrypi.local:8000",
        changeOrigin: true,
      },
      "/ws": {
        target: "ws://raspberrypi.local:8000",
        ws: true,
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: "dist",
  },
});
