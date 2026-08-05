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
import { analyzeExportChanges } from "~/analyzer/analyze-export-changes.js";

const execFileAsync = promisify(execFile);
const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

describe("analyzeExportChanges", () => {
  it("compares modified exports at HEAD with the working tree", async () => {
    const projectRoot = await createTemporaryRepository({
      "src/math.ts": `
        export function add(left: number, right: number) {
          return left + right;
        }
        export function subtract(left: number, right: number) {
          return left - right;
        }
      `,
    });
    await commitAll(projectRoot, "Baseline");
    await writeProjectFiles(projectRoot, {
      "src/math.ts": `
        export function add(left: number, right: number) {
          const result = left + right;
          return result;
        }
        export function subtract(left: number, right: number) {
          return left - right;
        }
      `,
    });

    const result = await analyzeExportChanges(projectRoot);

    expect(result.git.changes).toEqual([
      { status: "modified", path: "src/math.ts" },
    ]);
    expect(result.files).toHaveLength(1);
    expect(result.files[0]?.headExports.map(({ name }) => name)).toEqual([
      "add",
      "subtract",
    ]);
    expect(result.files[0]?.workingExports.map(({ name }) => name)).toEqual([
      "add",
      "subtract",
    ]);
    expect(
      result.files[0]?.exportedSymbolChanges.map(({ name, status }) => ({
        name,
        status,
      })),
    ).toEqual([{ name: "add", status: "modified" }]);
    expect(result.diagnostics).toEqual([]);
  });

  it("retains changed files whose exports did not semantically change", async () => {
    const projectRoot = await createTemporaryRepository({
      "src/value.ts": "export const value={answer:42};\n",
    });
    await commitAll(projectRoot, "Baseline");
    await writeProjectFiles(projectRoot, {
      "src/value.ts": `
        // Documentation only.
        export const value = {
          answer: 42,
        };
      `,
    });

    const result = await analyzeExportChanges(projectRoot);

    expect(result.files).toMatchObject([
      {
        fileChange: { status: "modified", path: "src/value.ts" },
        exportedSymbolChanges: [],
      },
    ]);
  });

  it("handles added, deleted, and renamed files", async () => {
    const projectRoot = await createTemporaryRepository({
      "src/deleted.ts": "export const removed = true;\n",
      "src/old-name.ts": "export const renamed = true;\n",
    });
    await commitAll(projectRoot, "Baseline");
    await unlink(path.join(projectRoot, "src/deleted.ts"));
    await rename(
      path.join(projectRoot, "src/old-name.ts"),
      path.join(projectRoot, "src/new-name.ts"),
    );
    await writeProjectFiles(projectRoot, {
      "src/added.ts": "export class Added {}\n",
    });

    const result = await analyzeExportChanges(projectRoot);
    const byPath = new Map(
      result.files.map((file) => [file.fileChange.path, file]),
    );

    expect(
      byPath
        .get("src/added.ts")
        ?.exportedSymbolChanges.map(({ name, status }) => ({ name, status })),
    ).toEqual([{ name: "Added", status: "added" }]);
    expect(
      byPath
        .get("src/deleted.ts")
        ?.exportedSymbolChanges.map(({ name, status }) => ({ name, status })),
    ).toEqual([{ name: "removed", status: "removed" }]);
    expect(byPath.get("src/new-name.ts")).toMatchObject({
      fileChange: {
        status: "renamed",
        path: "src/new-name.ts",
        previousPath: "src/old-name.ts",
      },
      exportedSymbolChanges: [],
    });
    expect(result.diagnostics).toEqual([]);
  });

  it("reads HEAD paths correctly when the selected project is nested", async () => {
    const repositoryRoot = await createTemporaryRepository({
      "packages/app/src/value.ts": "export const value = 'before';\n",
      "packages/other/src/value.ts": "export const other = 'before';\n",
    });
    await commitAll(repositoryRoot, "Monorepo baseline");
    await writeProjectFiles(repositoryRoot, {
      "packages/app/src/value.ts": "export const value = 'after';\n",
      "packages/other/src/value.ts": "export const other = 'after';\n",
    });

    const result = await analyzeExportChanges(
      path.join(repositoryRoot, "packages/app"),
    );

    expect(result.files).toHaveLength(1);
    expect(result.files[0]).toMatchObject({
      fileChange: { status: "modified", path: "src/value.ts" },
      exportedSymbolChanges: [{ name: "value", status: "modified" }],
    });
  });

  it("returns Git uncertainty without pretending exports were compared", async () => {
    const projectRoot = await createTemporaryDirectory({
      "src/value.ts": "export const value = true;\n",
    });

    const result = await analyzeExportChanges(projectRoot);

    expect(result.files).toEqual([]);
    expect(result.diagnostics).toEqual([]);
    expect(result.git.diagnostics).toMatchObject([
      { severity: "error", code: "not-git-repository" },
    ]);
  });

  it("rejects invalid file-read concurrency", async () => {
    await expect(
      analyzeExportChanges(".", { maxConcurrency: 0 }),
    ).rejects.toThrow("maxConcurrency must be a positive integer");
  });
});

async function createTemporaryRepository(
  files: Readonly<Record<string, string>>,
): Promise<string> {
  const projectRoot = await createTemporaryDirectory(files);
  await git(projectRoot, "init", "-b", "main");
  await git(projectRoot, "config", "user.name", "Code Atlas Tests");
  await git(projectRoot, "config", "user.email", "tests@code-atlas.local");
  return projectRoot;
}

async function createTemporaryDirectory(
  files: Readonly<Record<string, string>>,
): Promise<string> {
  const projectRoot = await mkdtemp(
    path.join(os.tmpdir(), "code-atlas-export-changes-"),
  );
  temporaryDirectories.push(projectRoot);
  await writeProjectFiles(projectRoot, files);
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
