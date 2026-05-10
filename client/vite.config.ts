import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"

export default defineConfig({
  plugins: [react()],
  base: "/static/",
  build: {
    outDir: "../static",
    emptyOutDir: true,
    rollupOptions: {
      output: {
        entryFileNames: "assets/[name].js",
        chunkFileNames: "assets/[name].js",
        assetFileNames: "assets/[name][extname]",
      },
    },
  },
  server: {
    port: 5173,
    proxy: {
      "/socket.io": { target: "http://127.0.0.1:5055", ws: true },
      "/api": { target: "http://127.0.0.1:5055" },
    },
  },
})
