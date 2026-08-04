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
import { detectGitChanges } from "~/analyzer/detect-git-changes.js";

const execFileAsync = promisify(execFile);
const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((directory) =>
      rm(directory, { recursive: true, force: true }),
    ),
  );
});

describe("detectGitChanges", () => {
  it("detects staged, unstaged, untracked, deleted, and renamed source files", async () => {
    const projectRoot = await createTemporaryRepository({
      ".gitignore": "ignored/\n",
      "README.md": "before\n",
      "src/deleted.ts": "export const deletedValue = 'deleted-original';\n",
      "src/legacy.ts": "export const legacyValue = 'legacy-original';\n",
      "src/modified.ts": "export const modifiedValue = 'before';\n",
      "src/notes.txt": "notes that become a source file\n",
      "src/old-name.ts": "export const renamedValue = 'rename-original';\n",
      "src/staged-old.ts": [
        "export const first = 1;",
        "export const second = 2;",
        "export const third = 3;",
        "export const fourth = 4;",
        "export const fifth = 5;",
        "export const sixth = 6;",
        "export const seventh = 7;",
        "export const eighth = 8;",
        "",
      ].join("\n"),
      "src/staged.ts": "export const stagedValue = 'before';\n",
      "src/unchanged.ts": "export const unchangedValue = true;\n",
    });
    await commitAll(projectRoot, "Initial fixture");

    await writeProjectFiles(projectRoot, {
      "README.md": "after\n",
      "ignored/ignored.ts": "export const ignored = true;\n",
      "src/modified.ts": "export const modifiedValue = 'after';\n",
      "src/new file.ts": "export const addedValue = true;\n",
      "src/UPPER.TS": "export const upper = true;\n",
      "src/staged.ts": "export const stagedValue = 'staged';\n",
    });
    await git(projectRoot, "add", "src/staged.ts");
    await writeProjectFiles(projectRoot, {
      "src/staged.ts": "export const stagedValue = 'staged-and-modified';\n",
    });
    await unlink(path.join(projectRoot, "src/deleted.ts"));
    await rename(
      path.join(projectRoot, "src/old-name.ts"),
      path.join(projectRoot, "src/renamed.ts"),
    );
    await rename(
      path.join(projectRoot, "src/legacy.ts"),
      path.join(projectRoot, "src/legacy.txt"),
    );
    await rename(
      path.join(projectRoot, "src/notes.txt"),
      path.join(projectRoot, "src/from-notes.ts"),
    );
    await rename(
      path.join(projectRoot, "src/staged-old.ts"),
      path.join(projectRoot, "src/staged-renamed.ts"),
    );
    await writeProjectFiles(projectRoot, {
      "src/staged-renamed.ts": [
        "export const first = 10;",
        "export const second = 2;",
        "export const third = 3;",
        "export const fourth = 4;",
        "export const fifth = 5;",
        "export const sixth = 6;",
        "export const seventh = 7;",
        "export const eighth = 8;",
        "",
      ].join("\n"),
    });
    await git(
      projectRoot,
      "add",
      "-A",
      "--",
      "src/staged-old.ts",
      "src/staged-renamed.ts",
    );

    const result = await detectGitChanges(projectRoot);

    expect(result.projectRoot).toBe(projectRoot);
    expect(result.repositoryRoot).toBe(projectRoot);
    expect(result.headCommit).toMatch(/^[0-9a-f]{40}$/);
    expect(result.changes).toEqual([
      { status: "added", path: "src/UPPER.TS" },
      { status: "deleted", path: "src/deleted.ts" },
      { status: "added", path: "src/from-notes.ts" },
      { status: "deleted", path: "src/legacy.ts" },
      { status: "modified", path: "src/modified.ts" },
      { status: "added", path: "src/new file.ts" },
      {
        status: "renamed",
        path: "src/renamed.ts",
        previousPath: "src/old-name.ts",
      },
      {
        status: "renamed",
        path: "src/staged-renamed.ts",
        previousPath: "src/staged-old.ts",
      },
      { status: "modified", path: "src/staged.ts" },
    ]);
    expect(result.diagnostics).toEqual([]);
  });

  it("scopes paths and changes to a selected project inside a repository", async () => {
    const repositoryRoot = await createTemporaryRepository({
      "packages/app/src/app.ts": "export const app = 'before';\n",
      "packages/other/src/other.ts": "export const other = 'before';\n",
    });
    await commitAll(repositoryRoot, "Initial monorepo");
    await writeProjectFiles(repositoryRoot, {
      "packages/app/src/app.ts": "export const app = 'after';\n",
      "packages/app/src/new.ts": "export const added = true;\n",
      "packages/other/src/other.ts": "export const other = 'after';\n",
      "root.ts": "export const root = true;\n",
    });
    const projectRoot = path.join(repositoryRoot, "packages/app");

    const result = await detectGitChanges(projectRoot);

    expect(result.projectRoot).toBe(projectRoot);
    expect(result.repositoryRoot).toBe(repositoryRoot);
    expect(result.changes).toEqual([
      { status: "modified", path: "src/app.ts" },
      { status: "added", path: "src/new.ts" },
    ]);
    expect(result.diagnostics).toEqual([]);
  });

  it("returns an empty result for a clean repository", async () => {
    const projectRoot = await createTemporaryRepository({
      "src/index.ts": "export const value = true;\n",
    });
    await commitAll(projectRoot, "Clean fixture");

    const result = await detectGitChanges(projectRoot);

    expect(result.changes).toEqual([]);
    expect(result.diagnostics).toEqual([]);
    expect(result.headCommit).toMatch(/^[0-9a-f]{40}$/);
  });

  it("retains conflicted source files as uncertain modified changes", async () => {
    const projectRoot = await createTemporaryRepository({
      "src/conflicted.ts": "export const value = 'initial';\n",
    });
    await commitAll(projectRoot, "Conflict base");
    await git(projectRoot, "switch", "-c", "incoming");
    await writeProjectFiles(projectRoot, {
      "src/conflicted.ts": "export const value = 'incoming';\n",
    });
    await commitAll(projectRoot, "Incoming change");
    await git(projectRoot, "switch", "main");
    await writeProjectFiles(projectRoot, {
      "src/conflicted.ts": "export const value = 'current';\n",
    });
    await commitAll(projectRoot, "Current change");

    await expect(
      execFileAsync("git", ["merge", "incoming"], {
        cwd: projectRoot,
        encoding: "utf8",
      }),
    ).rejects.toThrow();

    const result = await detectGitChanges(projectRoot);

    expect(result.changes).toEqual([
      { status: "modified", path: "src/conflicted.ts" },
    ]);
    expect(result.diagnostics).toEqual([
      {
        severity: "warning",
        code: "conflicted-file",
        message:
          "The file has unresolved Git conflicts and is treated as modified",
        path: "src/conflicted.ts",
      },
    ]);
  });

  it("reports a selected folder that is not a Git repository", async () => {
    const projectRoot = await createTemporaryDirectory({
      "src/index.ts": "export const value = true;\n",
    });

    const result = await detectGitChanges(projectRoot);

    expect(result).toEqual({
      projectRoot,
      changes: [],
      diagnostics: [
        {
          severity: "error",
          code: "not-git-repository",
          message: "The selected project is not inside a Git repository",
        },
      ],
    });
  });

  it("reports a repository without a committed HEAD revision", async () => {
    const projectRoot = await createTemporaryDirectory({
      "src/index.ts": "export const value = true;\n",
    });
    await git(projectRoot, "init", "-b", "main");

    const result = await detectGitChanges(projectRoot);

    expect(result).toEqual({
      projectRoot,
      repositoryRoot: projectRoot,
      changes: [],
      diagnostics: [
        {
          severity: "error",
          code: "no-head",
          message: "The Git repository does not have a committed HEAD revision",
        },
      ],
    });
  });
});

async function createTemporaryRepository(
  files: Readonly<Record<string, string>>,
): Promise<string> {
  const projectRoot = await createTemporaryDirectory(files);
  await git(projectRoot, "init", "-b", "main");
  await git(projectRoot, "config", "user.name", "Code Atlas Tests");
  await git(
    projectRoot,
    "config",
    "user.email",
    "code-atlas-tests@example.invalid",
  );
  return projectRoot;
}

async function createTemporaryDirectory(
  files: Readonly<Record<string, string>>,
): Promise<string> {
  const projectRoot = await mkdtemp(
    path.join(os.tmpdir(), "code-atlas-git-changes-"),
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

async function commitAll(
  projectRoot: string,
  message: string,
): Promise<void> {
  await git(projectRoot, "add", ".");
  await git(projectRoot, "commit", "-m", message);
}

async function git(projectRoot: string, ...arguments_: string[]): Promise<void> {
  await execFileAsync("git", arguments_, {
    cwd: projectRoot,
    encoding: "utf8",
  });
}
