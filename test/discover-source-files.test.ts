import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { discoverSourceFiles } from "../src/analyzer/discover-source-files.js";

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

describe("discoverSourceFiles", () => {
  it("returns deterministic file nodes for the sample project", async () => {
    const projectRoot = path.resolve(
      "test-projects/sample-project-template/base",
    );

    await expect(discoverSourceFiles(projectRoot)).resolves.toEqual([
      {
        id: "src/add-page.ts",
        path: "src/add-page.ts",
        name: "add-page.ts",
        extension: ".ts",
      },
      {
        id: "src/app.ts",
        path: "src/app.ts",
        name: "app.ts",
        extension: ".ts",
      },
      {
        id: "src/math.ts",
        path: "src/math.ts",
        name: "math.ts",
        extension: ".ts",
      },
      {
        id: "src/subtract-page.ts",
        path: "src/subtract-page.ts",
        name: "subtract-page.ts",
        extension: ".ts",
      },
    ]);
  });

  it("supports JavaScript and TypeScript module extensions", async () => {
    const projectRoot = await createTemporaryProject([
      "src/component.jsx",
      "src/component.tsx",
      "src/declarations.d.ts",
      "src/index.js",
      "src/module.cjs",
      "src/module.cts",
      "src/module.mjs",
      "src/module.mts",
      "src/readme.md",
    ]);

    const files = await discoverSourceFiles(projectRoot);

    expect(files.map((file) => [file.path, file.extension])).toEqual([
      ["src/component.jsx", ".jsx"],
      ["src/component.tsx", ".tsx"],
      ["src/declarations.d.ts", ".ts"],
      ["src/index.js", ".js"],
      ["src/module.cjs", ".cjs"],
      ["src/module.cts", ".cts"],
      ["src/module.mjs", ".mjs"],
      ["src/module.mts", ".mts"],
    ]);
  });

  it("skips generated directories and accepts additional ignore rules", async () => {
    const projectRoot = await createTemporaryProject([
      ".git/hooks/example.ts",
      ".next/server/example.ts",
      ".nuxt/example.ts",
      ".output/example.ts",
      "build/example.ts",
      "coverage/example.ts",
      "dist/example.ts",
      "node_modules/example/index.ts",
      "out/example.ts",
      "src/generated/example.ts",
      "src/kept.ts",
    ]);

    const files = await discoverSourceFiles(projectRoot, {
      additionalIgnoredDirectoryNames: ["generated"],
    });

    expect(files.map((file) => file.path)).toEqual(["src/kept.ts"]);
  });
});

async function createTemporaryProject(
  filePaths: readonly string[],
): Promise<string> {
  const projectRoot = await mkdtemp(
    path.join(os.tmpdir(), "code-atlas-discovery-"),
  );
  temporaryDirectories.push(projectRoot);

  for (const filePath of filePaths) {
    const absolutePath = path.join(projectRoot, filePath);
    await mkdir(path.dirname(absolutePath), { recursive: true });
    await writeFile(absolutePath, "", "utf8");
  }

  return projectRoot;
}
