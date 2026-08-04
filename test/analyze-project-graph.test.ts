import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { analyzeProjectGraph } from "~/analyzer/analyze-project-graph.js";

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((directory) =>
      rm(directory, { recursive: true, force: true }),
    ),
  );
});

describe("analyzeProjectGraph", () => {
  it("assembles every sample-project file and internal import edge", async () => {
    const projectRoot = path.resolve(
      "test-projects/sample-project-template/base",
    );

    const result = await analyzeProjectGraph(projectRoot);

    expect(result.projectRoot).toBe(projectRoot);
    expect(result.graph.nodes.map((node) => node.path)).toEqual([
      "src/add-page.ts",
      "src/app.ts",
      "src/math.ts",
      "src/subtract-page.ts",
    ]);
    expect(
      result.graph.edges.map(({ source, target, certainty, references }) => ({
        source,
        target,
        certainty,
        importedNames: references.flatMap((reference) =>
          reference.bindings.map((binding) => binding.importedName),
        ),
      })),
    ).toEqual([
      {
        source: "src/add-page.ts",
        target: "src/math.ts",
        certainty: "confirmed",
        importedNames: ["add"],
      },
      {
        source: "src/app.ts",
        target: "src/add-page.ts",
        certainty: "confirmed",
        importedNames: ["renderAddPage"],
      },
      {
        source: "src/app.ts",
        target: "src/subtract-page.ts",
        certainty: "confirmed",
        importedNames: ["renderSubtractPage"],
      },
      {
        source: "src/subtract-page.ts",
        target: "src/math.ts",
        certainty: "confirmed",
        importedNames: ["subtract"],
      },
    ]);
    expect(result.moduleResolutions).toHaveLength(4);
    expect(
      result.moduleResolutions.every(
        (resolution) => resolution.status === "internal",
      ),
    ).toBe(true);
    expect(result.diagnostics).toEqual([]);
  });

  it("aggregates references by file pair and retains non-edge outcomes", async () => {
    const projectRoot = await createTemporaryProject({
      "src/entry.ts": `
        import { first } from "./target.js";
        const targetAgain = require("./target.js");
        import "external-package";
        import missing from "./missing.js";
        const page = "home";
        const lazy = import(\`./pages/\${page}.js\`);
      `,
      "src/target.ts": "export const first = 1;",
      "src/standalone.ts": "export const standalone = true;",
    });

    const result = await analyzeProjectGraph(projectRoot, {
      maxConcurrency: 1,
    });

    expect(result.graph.nodes).toHaveLength(3);
    expect(result.graph.edges).toHaveLength(1);
    expect(result.graph.edges[0]).toMatchObject({
      source: "src/entry.ts",
      target: "src/target.ts",
      certainty: "confirmed",
    });
    expect(
      result.graph.edges[0]?.references.map((reference) => ({
        kind: reference.kind,
        certainty: reference.certainty,
      })),
    ).toEqual([
      { kind: "import", certainty: "confirmed" },
      { kind: "require", certainty: "inferred" },
    ]);
    expect(
      result.moduleResolutions.map(({ status, reference, targetFile }) => ({
        specifier: reference.specifier,
        status,
        targetFile,
      })),
    ).toEqual([
      {
        specifier: "./target.js",
        status: "internal",
        targetFile: "src/target.ts",
      },
      {
        specifier: "./target.js",
        status: "internal",
        targetFile: "src/target.ts",
      },
      {
        specifier: "external-package",
        status: "external",
        targetFile: undefined,
      },
      {
        specifier: "./missing.js",
        status: "unresolved",
        targetFile: undefined,
      },
    ]);
    expect(result.diagnostics).toEqual([
      {
        phase: "parse",
        severity: "warning",
        message: "Dynamic import specifier cannot be determined statically",
        sourceFile: "src/entry.ts",
      },
      {
        phase: "resolution",
        severity: "warning",
        message: 'Could not resolve module "./missing.js"',
        sourceFile: "src/entry.ts",
        specifier: "./missing.js",
      },
    ]);
  });

  it("reports configuration problems and forwards discovery exclusions", async () => {
    const projectRoot = await createTemporaryProject({
      "tsconfig.json": "{ invalid",
      "src/index.ts": "export {};",
      "generated/ignored.ts": "export const ignored = true;",
    });

    const result = await analyzeProjectGraph(projectRoot, {
      additionalIgnoredDirectoryNames: ["generated"],
    });

    expect(result.graph.nodes.map((node) => node.path)).toEqual([
      "src/index.ts",
    ]);
    expect(result.graph.edges).toEqual([]);
    expect(result.diagnostics).toHaveLength(1);
    expect(result.diagnostics[0]).toMatchObject({
      phase: "configuration",
      severity: "warning",
    });
  });

  it("marks require-only graph relationships as inferred", async () => {
    const projectRoot = await createTemporaryProject({
      "src/legacy.cjs": `
        const target = require("./target.cjs");
        module.exports = target;
      `,
      "src/target.cjs": "module.exports = { value: 1 };",
    });

    const result = await analyzeProjectGraph(projectRoot);

    expect(result.graph.edges).toHaveLength(1);
    expect(result.graph.edges[0]).toMatchObject({
      source: "src/legacy.cjs",
      target: "src/target.cjs",
      certainty: "inferred",
      references: [
        {
          kind: "require",
          specifier: "./target.cjs",
          certainty: "inferred",
        },
      ],
    });
  });

  it("rejects invalid file-read concurrency", async () => {
    await expect(
      analyzeProjectGraph(".", { maxConcurrency: 0 }),
    ).rejects.toThrow("maxConcurrency must be a positive integer");
  });
});

async function createTemporaryProject(
  files: Readonly<Record<string, string>>,
): Promise<string> {
  const projectRoot = await mkdtemp(
    path.join(os.tmpdir(), "code-atlas-project-graph-"),
  );
  temporaryDirectories.push(projectRoot);

  for (const [filePath, contents] of Object.entries(files)) {
    const absolutePath = path.join(projectRoot, filePath);
    await mkdir(path.dirname(absolutePath), { recursive: true });
    await writeFile(absolutePath, contents, "utf8");
  }

  return projectRoot;
}
