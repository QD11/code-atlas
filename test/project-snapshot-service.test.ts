import { execFile } from "node:child_process";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { afterEach, describe, expect, it } from "vitest";
import {
  createProjectSnapshotService,
  type SnapshotServiceEvent,
} from "~/server/project-snapshot-service.js";

const execFileAsync = promisify(execFile);
const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

describe("project snapshot service", () => {
  it("refreshes explicitly and publishes monotonically increasing revisions", async () => {
    const projectRoot = await createTemporaryRepository({
      "src/value.ts": "export const value = 1;\n",
    });
    const service = await createProjectSnapshotService({
      projectRoot,
      watch: false,
    });
    const events: SnapshotServiceEvent[] = [];
    const unsubscribe = service.subscribe((event) => events.push(event));

    await writeProjectFiles(projectRoot, {
      "src/value.ts": "export const value = 2;\n",
    });
    const state = await service.refresh();

    expect(state.revision).toBe(2);
    expect(state.snapshot.hasExportChanges).toBe(true);
    expect(state.snapshot.changedFiles[0]?.exportedSymbolChanges).toMatchObject(
      [{ name: "value", status: "modified" }],
    );
    expect(events).toMatchObject([
      { type: "snapshot", state: { revision: 2 } },
    ]);

    unsubscribe();
    await service.close();
  });

  it("automatically refreshes after a supported source file changes", async () => {
    const projectRoot = await createTemporaryRepository({
      "src/value.ts": "export const value = 1;\n",
    });
    const service = await createProjectSnapshotService({
      projectRoot,
      debounceMs: 10,
    });

    try {
      const nextSnapshot = waitForSnapshot(service, 2);
      await writeProjectFiles(projectRoot, {
        "src/value.ts": "export const value = 3;\n",
      });

      const event = await nextSnapshot;

      expect(event.state.revision).toBeGreaterThanOrEqual(2);
      expect(event.state.snapshot.hasChanges).toBe(true);
      expect(
        event.state.snapshot.changedFiles[0]?.exportedSymbolChanges,
      ).toMatchObject([{ name: "value", status: "modified" }]);
    } finally {
      await service.close();
    }
  });

  it("ignores changes inside dependency directories", async () => {
    const projectRoot = await createTemporaryRepository({
      "node_modules/example/index.ts": "export const dependency = 1;\n",
      "src/value.ts": "export const value = 1;\n",
    });
    const service = await createProjectSnapshotService({
      projectRoot,
      debounceMs: 5,
    });
    const events: SnapshotServiceEvent[] = [];
    service.subscribe((event) => events.push(event));

    try {
      await writeProjectFiles(projectRoot, {
        "node_modules/example/index.ts": "export const dependency = 2;\n",
      });
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(service.getState().revision).toBe(1);
      expect(events).toEqual([]);
    } finally {
      await service.close();
    }
  });

  it("refreshes when a new Git commit becomes the comparison baseline", async () => {
    const projectRoot = await createTemporaryRepository({
      "src/value.ts": "export const value = 1;\n",
    });
    const service = await createProjectSnapshotService({
      projectRoot,
      debounceMs: 10,
    });

    try {
      const changedSnapshot = waitForSnapshotMatching(
        service,
        ({ state }) => state.snapshot.hasExportChanges,
      );
      await writeProjectFiles(projectRoot, {
        "src/value.ts": "export const value = 4;\n",
      });
      await changedSnapshot;

      const cleanSnapshot = waitForSnapshotMatching(
        service,
        ({ state }) => !state.snapshot.hasChanges,
      );
      await git(projectRoot, "add", ".");
      await git(projectRoot, "commit", "-m", "Update baseline");

      const event = await cleanSnapshot;

      expect(event.state.snapshot.hasChanges).toBe(false);
      expect(event.state.snapshot.headCommit).toMatch(/^[0-9a-f]{40}$/);
    } finally {
      await service.close();
    }
  });

  it("rejects invalid debounce values", async () => {
    const projectRoot = await createTemporaryRepository({
      "src/value.ts": "export const value = 1;\n",
    });

    await expect(
      createProjectSnapshotService({ projectRoot, debounceMs: -1 }),
    ).rejects.toThrow("debounceMs must be a non-negative number");
  });
});

function waitForSnapshot(
  service: Awaited<ReturnType<typeof createProjectSnapshotService>>,
  minimumRevision: number,
): Promise<Extract<SnapshotServiceEvent, { type: "snapshot" }>> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      unsubscribe();
      reject(new Error("Timed out waiting for a snapshot update"));
    }, 5_000);
    const unsubscribe = service.subscribe((event) => {
      if (event.type !== "snapshot" || event.state.revision < minimumRevision) {
        return;
      }

      clearTimeout(timeout);
      unsubscribe();
      resolve(event);
    });
  });
}

function waitForSnapshotMatching(
  service: Awaited<ReturnType<typeof createProjectSnapshotService>>,
  predicate: (
    event: Extract<SnapshotServiceEvent, { type: "snapshot" }>,
  ) => boolean,
): Promise<Extract<SnapshotServiceEvent, { type: "snapshot" }>> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      unsubscribe();
      reject(new Error("Timed out waiting for a matching snapshot"));
    }, 5_000);
    const unsubscribe = service.subscribe((event) => {
      if (event.type !== "snapshot" || !predicate(event)) return;

      clearTimeout(timeout);
      unsubscribe();
      resolve(event);
    });
  });
}

async function createTemporaryRepository(
  files: Readonly<Record<string, string>>,
): Promise<string> {
  const projectRoot = await mkdtemp(
    path.join(os.tmpdir(), "code-atlas-live-snapshot-"),
  );
  temporaryDirectories.push(projectRoot);
  await writeProjectFiles(projectRoot, files);
  await git(projectRoot, "init", "-b", "main");
  await git(projectRoot, "config", "user.name", "Code Atlas Tests");
  await git(projectRoot, "config", "user.email", "tests@code-atlas.local");
  await git(projectRoot, "add", ".");
  await git(projectRoot, "commit", "-m", "Baseline");
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

async function git(
  projectRoot: string,
  ...arguments_: string[]
): Promise<void> {
  await execFileAsync("git", arguments_, {
    cwd: projectRoot,
    encoding: "utf8",
  });
}
