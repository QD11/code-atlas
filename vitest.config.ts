import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const repositoryRoot = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    alias: [
      {
        find: "@shared",
        replacement: path.join(repositoryRoot, "src/shared"),
      },
      {
        find: "~/app",
        replacement: path.join(repositoryRoot, "web/src/app"),
      },
      {
        find: "~/components",
        replacement: path.join(repositoryRoot, "web/src/components"),
      },
      {
        find: "~",
        replacement: path.join(repositoryRoot, "src"),
      },
    ],
  },
});
