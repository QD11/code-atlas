import {
  mkdir,
  mkdtemp,
  readFile,
  rm,
  writeFile,
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { discoverSourceFiles } from "~/analyzer/discover-source-files.js";
import { loadTypeScriptProjectConfig } from "~/analyzer/load-typescript-project-config.js";
import { parseModuleReferences } from "~/analyzer/parse-module-references.js";
import { createModuleResolver } from "~/analyzer/resolve-module-references.js";

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((directory) =>
      rm(directory, { recursive: true, force: true }),
    ),
  );
});

describe("createModuleResolver", () => {
  it("resolves the sample project's JavaScript specifiers to TypeScript files", async () => {
    const projectRoot = path.resolve(
      "test-projects/sample-project-template/base",
    );
    const projectFiles = await discoverSourceFiles(projectRoot);
    const sourceFile = requiredFile(projectFiles, "src/app.ts");
    const sourceText = await readFile(
      path.join(projectRoot, sourceFile.path),
      "utf8",
    );
    const parsed = parseModuleReferences(sourceFile.path, sourceText);
    const config = loadTypeScriptProjectConfig(projectRoot);

    const resolver = createModuleResolver({
      projectRoot,
      projectFiles,
      compilerOptions: config.compilerOptions,
    });
    const resolved = resolver.resolve(sourceFile, parsed.references);

    expect(
      resolved.resolutions.map(({ status, targetFile, reference }) => ({
        specifier: reference.specifier,
        status,
        targetFile,
      })),
    ).toEqual([
      {
        specifier: "./add-page.js",
        status: "internal",
        targetFile: "src/add-page.ts",
      },
      {
        specifier: "./subtract-page.js",
        status: "internal",
        targetFile: "src/subtract-page.ts",
      },
    ]);
    expect([...config.diagnostics, ...resolved.diagnostics]).toEqual([]);
  });

  it("handles aliases, extensionless paths, externals, and failures", async () => {
    const projectRoot = await createTemporaryProject({
      "package.json": JSON.stringify({
        private: true,
        type: "module",
      }),
      "tsconfig.json": JSON.stringify({
        compilerOptions: {
          module: "NodeNext",
          moduleResolution: "NodeNext",
          paths: {
            "@core/*": ["./src/core/*"],
          },
          resolveJsonModule: true,
          target: "ES2022",
        },
        include: ["src"],
      }),
      "src/entry.ts": `
        import { math } from "./math.js";
        import { tool } from "./tools";
        import { value } from "@core/value";
        import fs from "node:fs";
        import react from "react";
        import missing from "./missing.js";
        import data from "./data.json";
      `,
      "src/math.ts": "export const math = 1;",
      "src/tools/index.ts": "export const tool = 1;",
      "src/core/value.ts": "export const value = 1;",
      "src/data.json": "{}",
    });
    const projectFiles = await discoverSourceFiles(projectRoot);
    const sourceFile = requiredFile(projectFiles, "src/entry.ts");
    const parsed = parseModuleReferences(
      sourceFile.path,
      await readFile(path.join(projectRoot, sourceFile.path), "utf8"),
    );
    const config = loadTypeScriptProjectConfig(projectRoot);

    const resolver = createModuleResolver({
      projectRoot,
      projectFiles,
      compilerOptions: config.compilerOptions,
    });
    const resolved = resolver.resolve(sourceFile, parsed.references);

    expect(
      resolved.resolutions.map(({ status, targetFile, reference }) => ({
        specifier: reference.specifier,
        status,
        targetFile,
      })),
    ).toEqual([
      {
        specifier: "./math.js",
        status: "internal",
        targetFile: "src/math.ts",
      },
      {
        specifier: "./tools",
        status: "internal",
        targetFile: "src/tools/index.ts",
      },
      {
        specifier: "@core/value",
        status: "internal",
        targetFile: "src/core/value.ts",
      },
      {
        specifier: "node:fs",
        status: "external",
        targetFile: undefined,
      },
      {
        specifier: "react",
        status: "external",
        targetFile: undefined,
      },
      {
        specifier: "./missing.js",
        status: "unresolved",
        targetFile: undefined,
      },
      {
        specifier: "./data.json",
        status: "unsupported",
        targetFile: "src/data.json",
      },
    ]);
    expect(resolved.diagnostics).toEqual([
      {
        severity: "warning",
        message: 'Could not resolve module "./missing.js"',
        sourceFile: "src/entry.ts",
        specifier: "./missing.js",
      },
      {
        severity: "warning",
        message:
          'Module "./data.json" resolved to an unsupported project file',
        sourceFile: "src/entry.ts",
        specifier: "./data.json",
      },
    ]);
  });

  it("resolves dynamic, CommonJS, and import-equals references", async () => {
    const projectRoot = await createTemporaryProject({
      "tsconfig.json": JSON.stringify({
        compilerOptions: {
          module: "NodeNext",
          moduleResolution: "NodeNext",
        },
        include: ["src"],
      }),
      "src/runtime.ts": `
        const lazy = import("./target.js");
        const commonJs = require("./target.js");
        import legacy = require("./target.js");
      `,
      "src/target.ts": "export const value = 1;",
    });
    const projectFiles = await discoverSourceFiles(projectRoot);
    const sourceFile = requiredFile(projectFiles, "src/runtime.ts");
    const parsed = parseModuleReferences(
      sourceFile.path,
      await readFile(path.join(projectRoot, sourceFile.path), "utf8"),
    );
    const config = loadTypeScriptProjectConfig(projectRoot);

    const resolver = createModuleResolver({
      projectRoot,
      projectFiles,
      compilerOptions: config.compilerOptions,
    });
    const resolved = resolver.resolve(sourceFile, parsed.references);

    expect(
      resolved.resolutions.map(({ status, targetFile, reference }) => ({
        kind: reference.kind,
        status,
        targetFile,
      })),
    ).toEqual([
      {
        kind: "dynamic-import",
        status: "internal",
        targetFile: "src/target.ts",
      },
      {
        kind: "require",
        status: "internal",
        targetFile: "src/target.ts",
      },
      {
        kind: "import-equals",
        status: "internal",
        targetFile: "src/target.ts",
      },
    ]);
    expect(resolved.diagnostics).toEqual([]);
  });

  it("reports malformed TypeScript project configuration", async () => {
    const projectRoot = await createTemporaryProject({
      "tsconfig.json": "{ invalid",
      "src/index.ts": "export {};",
    });

    const config = loadTypeScriptProjectConfig(projectRoot);

    expect(config.diagnostics.length).toBeGreaterThan(0);
    expect(config.diagnostics[0]?.severity).toBe("warning");
  });

  it("loads jsconfig aliases without inheriting a parent config", async () => {
    const parentRoot = await createTemporaryProject({
      "tsconfig.json": "{ invalid",
      "plain-project/jsconfig.json": JSON.stringify({
        compilerOptions: {
          paths: {
            "@app/*": ["./src/*"],
          },
        },
      }),
      "plain-project/src/entry.js": `
        import { value } from "@app/value";
      `,
      "plain-project/src/value.js": "export const value = 1;",
      "no-config/src/index.js": "export {};",
    });
    const projectRoot = path.join(parentRoot, "plain-project");
    const projectFiles = await discoverSourceFiles(projectRoot);
    const sourceFile = requiredFile(projectFiles, "src/entry.js");
    const parsed = parseModuleReferences(
      sourceFile.path,
      await readFile(path.join(projectRoot, sourceFile.path), "utf8"),
    );
    const config = loadTypeScriptProjectConfig(projectRoot);
    const resolver = createModuleResolver({
      projectRoot,
      projectFiles,
      compilerOptions: config.compilerOptions,
    });

    expect(
      resolver.resolve(sourceFile, parsed.references).resolutions[0],
    ).toMatchObject({
      status: "internal",
      targetFile: "src/value.js",
    });
    expect(config.diagnostics).toEqual([]);

    const noConfig = loadTypeScriptProjectConfig(
      path.join(parentRoot, "no-config"),
    );
    expect(noConfig.diagnostics).toEqual([]);
    expect(noConfig.compilerOptions.paths).toBeUndefined();
  });
});

function requiredFile(
  files: Awaited<ReturnType<typeof discoverSourceFiles>>,
  filePath: string,
) {
  const file = files.find((candidate) => candidate.path === filePath);
  if (!file) throw new Error(`Fixture file was not discovered: ${filePath}`);
  return file;
}

async function createTemporaryProject(
  files: Readonly<Record<string, string>>,
): Promise<string> {
  const projectRoot = await mkdtemp(
    path.join(os.tmpdir(), "code-atlas-resolution-"),
  );
  temporaryDirectories.push(projectRoot);

  for (const [filePath, contents] of Object.entries(files)) {
    const absolutePath = path.join(projectRoot, filePath);
    await mkdir(path.dirname(absolutePath), { recursive: true });
    await writeFile(absolutePath, contents, "utf8");
  }

  return projectRoot;
}
