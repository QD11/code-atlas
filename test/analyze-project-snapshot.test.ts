import { execFile } from "node:child_process";
import {
  mkdir,
  mkdtemp,
  rename,
  rm,
  unlink,
  writeFile,
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { afterEach, describe, expect, it } from "vitest";
import { analyzeProjectSnapshot } from "~/analyzer/analyze-project-snapshot.js";

const execFileAsync = promisify(execFile);
const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

describe("analyzeProjectSnapshot", () => {
  it("assembles the full graph, changes, exact impacts, and transitive paths", async () => {
    const projectRoot = await createTemporaryRepository({
      "src/add-page.ts": `
        import { add } from "./math.js";
        export const renderAddPage = () => add(1, 2);
      `,
      "src/app.ts": `
        import { renderAddPage } from "./add-page.js";
        export const app = () => renderAddPage();
      `,
      "src/math.ts": `
        export const add = (left: number, right: number) => left + right;
        export const subtract = (left: number, right: number) => left - right;
      `,
      "src/subtract-page.ts": `
        import { subtract } from "./math.js";
        export const renderSubtractPage = () => subtract(2, 1);
      `,
    });
    await commitAll(projectRoot, "Baseline");
    await writeProjectFiles(projectRoot, {
      "src/math.ts": `
        export function add(left: number, right: number) {
          return left + right;
        }
        export const subtract = (left: number, right: number) => left - right;
      `,
    });

    const snapshot = await analyzeProjectSnapshot(projectRoot);
    const nodeByPath = new Map(
      snapshot.graph.nodes.map((node) => [node.path, node]),
    );

    expect(snapshot.hasChanges).toBe(true);
    expect(snapshot.hasExportChanges).toBe(true);
    expect(snapshot.graph.nodes).toHaveLength(4);
    expect(snapshot.graph.edges).toHaveLength(3);
    expect(nodeByPath.get("src/math.ts")).toMatchObject({
      exists: true,
      changeStatus: "modified",
      changedExports: [{ name: "add", status: "modified" }],
      impactLevels: ["direct-change"],
    });
    expect(nodeByPath.get("src/add-page.ts")).toMatchObject({
      impactLevels: ["direct-impact"],
      impactReasons: [
        {
          origin: { filePath: "src/math.ts", name: "add" },
          distance: 1,
          certainty: "confirmed",
        },
      ],
    });
    expect(nodeByPath.get("src/app.ts")).toMatchObject({
      impactLevels: ["transitive-impact"],
      impactReasons: [{ distance: 2, certainty: "inferred" }],
    });
    expect(nodeByPath.get("src/subtract-page.ts")).toMatchObject({
      impactLevels: [],
      impactReasons: [],
    });
    expect(
      snapshot.graph.edges.find(
        ({ source, target }) =>
          source === "src/add-page.ts" && target === "src/math.ts",
      ),
    ).toMatchObject({
      historical: false,
      impact: {
        directChanges: [{ name: "add" }],
        transitiveOrigins: [],
      },
    });
    expect(snapshot.diagnostics).toEqual({
      project: [],
      git: [],
      exports: [],
    });
  });

  it("keeps the complete graph explorable when there are no changes", async () => {
    const projectRoot = await createTemporaryRepository({
      "src/index.ts": `
        import { value } from "./value.js";
        console.log(value);
      `,
      "src/value.ts": "export const value = true;\n",
    });
    await commitAll(projectRoot, "Clean baseline");

    const snapshot = await analyzeProjectSnapshot(projectRoot);

    expect(snapshot.hasChanges).toBe(false);
    expect(snapshot.hasExportChanges).toBe(false);
    expect(snapshot.changedFiles).toEqual([]);
    expect(snapshot.graph.nodes).toHaveLength(2);
    expect(snapshot.graph.edges).toHaveLength(1);
    expect(
      snapshot.graph.nodes.every(
        ({ impactLevels }) => impactLevels.length === 0,
      ),
    ).toBe(true);
  });

  it("recovers inferred edges to deleted changed files", async () => {
    const projectRoot = await createTemporaryRepository({
      "src/consumer.ts": `
        import { removed } from "./removed.js";
        export const consumer = removed;
      `,
      "src/removed.ts": "export const removed = 'before';\n",
    });
    await commitAll(projectRoot, "Baseline");
    await unlink(path.join(projectRoot, "src/removed.ts"));

    const snapshot = await analyzeProjectSnapshot(projectRoot);
    const removed = snapshot.graph.nodes.find(
      ({ path: filePath }) => filePath === "src/removed.ts",
    );
    const consumer = snapshot.graph.nodes.find(
      ({ path: filePath }) => filePath === "src/consumer.ts",
    );

    expect(removed).toMatchObject({
      exists: false,
      changeStatus: "deleted",
      changedExports: [{ name: "removed", status: "removed" }],
      impactLevels: ["direct-change"],
    });
    expect(consumer).toMatchObject({
      impactLevels: ["direct-impact"],
      impactReasons: [{ certainty: "inferred" }],
    });
    expect(snapshot.graph.edges).toMatchObject([
      {
        source: "src/consumer.ts",
        target: "src/removed.ts",
        certainty: "inferred",
        historical: true,
        impact: {
          directChanges: [{ name: "removed" }],
        },
      },
    ]);
    expect(snapshot.diagnostics.project).toMatchObject([
      {
        phase: "resolution",
        severity: "warning",
        sourceFile: "src/consumer.ts",
        specifier: "./removed.js",
      },
    ]);
  });

  it("connects stale imports to a renamed changed file as inferred", async () => {
    const projectRoot = await createTemporaryRepository({
      "src/consumer.ts": `
        import { value } from "./old-name.js";
        export const consumer = value();
      `,
      "src/old-name.ts": `
        export function value() {
          return 4;
        }
        export const unchanged01 = 1;
        export const unchanged02 = 2;
        export const unchanged03 = 3;
        export const unchanged04 = 4;
        export const unchanged05 = 5;
        export const unchanged06 = 6;
        export const unchanged07 = 7;
        export const unchanged08 = 8;
        export const unchanged09 = 9;
        export const unchanged10 = 10;
      `,
    });
    await commitAll(projectRoot, "Baseline");
    await rename(
      path.join(projectRoot, "src/old-name.ts"),
      path.join(projectRoot, "src/new-name.ts"),
    );
    await writeProjectFiles(projectRoot, {
      "src/new-name.ts": `
        export function value() {
          return 5;
        }
        export const unchanged01 = 1;
        export const unchanged02 = 2;
        export const unchanged03 = 3;
        export const unchanged04 = 4;
        export const unchanged05 = 5;
        export const unchanged06 = 6;
        export const unchanged07 = 7;
        export const unchanged08 = 8;
        export const unchanged09 = 9;
        export const unchanged10 = 10;
      `,
    });
    await git(projectRoot, "add", "-A");

    const snapshot = await analyzeProjectSnapshot(projectRoot);

    expect(snapshot.changedFiles.map(({ fileChange }) => fileChange)).toEqual([
      {
        status: "renamed",
        path: "src/new-name.ts",
        previousPath: "src/old-name.ts",
      },
    ]);
    expect(
      snapshot.graph.nodes.find(
        ({ path: filePath }) => filePath === "src/new-name.ts",
      ),
    ).toMatchObject({
      exists: true,
      changeStatus: "renamed",
      previousPath: "src/old-name.ts",
      impactLevels: ["direct-change"],
    });
    expect(snapshot.graph.edges).toMatchObject([
      {
        source: "src/consumer.ts",
        target: "src/new-name.ts",
        certainty: "inferred",
        historical: true,
        impact: {
          directChanges: [{ name: "value" }],
        },
      },
    ]);
  });

  it("never includes raw source contents in the serialized snapshot", async () => {
    const confidentialFixture = "private-fixture-value-do-not-serialize";
    const projectRoot = await createTemporaryRepository({
      "src/value.ts": `
        const internalCredential = "${confidentialFixture}";
        export const publicValue = 1;
      `,
    });
    await commitAll(projectRoot, "Baseline");
    await writeProjectFiles(projectRoot, {
      "src/value.ts": `
        const internalCredential = "${confidentialFixture}";
        export const publicValue = 2;
      `,
    });

    const snapshot = await analyzeProjectSnapshot(projectRoot);

    expect(JSON.stringify(snapshot)).not.toContain(confidentialFixture);
  });
});

async function createTemporaryRepository(
  files: Readonly<Record<string, string>>,
): Promise<string> {
  const projectRoot = await mkdtemp(
    path.join(os.tmpdir(), "code-atlas-snapshot-"),
  );
  temporaryDirectories.push(projectRoot);
  await writeProjectFiles(projectRoot, files);
  await git(projectRoot, "init", "-b", "main");
  await git(projectRoot, "config", "user.name", "Code Atlas Tests");
  await git(projectRoot, "config", "user.email", "tests@code-atlas.local");
  return projectRoot;
}

async function writeProjectFiles(
  projectRoot: string,
  files: Readonly<Record<string, string>>,
): Promise<void> {
  for (const [filePath, contents] of Object.entries(files)) {
    const absolutePath = path.join(projectRoot, filePath);
    await mkdir(path.dirname(absolutePath), { recursive: true });
    await writeFile(absolutePath, contents, "utf8");
  }
}

async function commitAll(projectRoot: string, message: string): Promise<void> {
  await git(projectRoot, "add", ".");
  await git(projectRoot, "commit", "-m", message);
}

async function git(
  projectRoot: string,
  ...arguments_: string[]
): Promise<void> {
  await execFileAsync("git", arguments_, {
    cwd: projectRoot,
    encoding: "utf8",
  });
}
