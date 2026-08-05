import path from "node:path";
import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const webRoot = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  root: webRoot,
  plugins: [react()],
  resolve: {
    alias: [
      {
        find: /^gl-bench$/,
        replacement: path.resolve(
          webRoot,
          "../node_modules/gl-bench/dist/gl-bench.module.js",
        ),
      },
      {
        find: "~",
        replacement: path.resolve(webRoot, "src"),
      },
    ],
  },
  server: {
    host: "127.0.0.1",
    port: 5173,
    strictPort: true,
    proxy: {
      "/api": "http://127.0.0.1:43110",
    },
  },
  build: {
    outDir: path.resolve(webRoot, "../dist/web"),
    emptyOutDir: false,
  },
});
