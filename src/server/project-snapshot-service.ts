import { realpath } from "node:fs/promises";
import path from "node:path";
import { watch, type FSWatcher } from "chokidar";
import {
  analyzeProjectSnapshot,
  type AnalyzeProjectSnapshotOptions,
} from "~/analyzer/analyze-project-snapshot.js";
import { DEFAULT_IGNORED_DIRECTORY_NAMES } from "~/analyzer/discover-source-files.js";
import { runGit } from "~/analyzer/git/run-git.js";
import { SUPPORTED_SOURCE_EXTENSIONS } from "~/shared/file-node.js";
import type { ProjectSnapshot } from "~/shared/project-snapshot.js";

export interface SnapshotState {
  revision: number;
  snapshot: ProjectSnapshot;
}

export type SnapshotServiceEvent =
  | {
      type: "snapshot";
      state: SnapshotState;
    }
  | {
      type: "error";
      revision: number;
      message: string;
    };

export interface ProjectSnapshotService {
  getState(): SnapshotState;
  refresh(): Promise<SnapshotState>;
  subscribe(listener: (event: SnapshotServiceEvent) => void): () => void;
  close(): Promise<void>;
}

export interface CreateProjectSnapshotServiceOptions extends AnalyzeProjectSnapshotOptions {
  projectRoot: string;
  /**
   * Watches source, project configuration, and relevant Git state.
   *
   * @default true
   */
  watch?: boolean;
  /**
   * Collapses bursts of filesystem events into one analysis.
   *
   * @default 75
   */
  debounceMs?: number;
}

const watchedConfigurationNames = new Set([
  "jsconfig.json",
  "package.json",
  "tsconfig.json",
]);
const supportedExtensions = new Set<string>(SUPPORTED_SOURCE_EXTENSIONS);

export async function createProjectSnapshotService(
  options: CreateProjectSnapshotServiceOptions,
): Promise<ProjectSnapshotService> {
  const projectRoot = path.resolve(options.projectRoot);
  const debounceMs = validatedDebounce(options.debounceMs);
  const analysisOptions: AnalyzeProjectSnapshotOptions = {
    ...(options.maxConcurrency === undefined
      ? {}
      : { maxConcurrency: options.maxConcurrency }),
    ...(options.additionalIgnoredDirectoryNames === undefined
      ? {}
      : {
          additionalIgnoredDirectoryNames:
            options.additionalIgnoredDirectoryNames,
        }),
  };
  let state: SnapshotState = {
    revision: 1,
    snapshot: await analyzeProjectSnapshot(projectRoot, analysisOptions),
  };
  let watcher: FSWatcher | undefined;
  let debounceTimer: NodeJS.Timeout | undefined;
  let refreshInFlight: Promise<SnapshotState> | undefined;
  let refreshRequested = false;
  let closed = false;
  const listeners = new Set<(event: SnapshotServiceEvent) => void>();

  const service: ProjectSnapshotService = {
    getState() {
      return state;
    },
    refresh,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    async close() {
      if (closed) return;
      closed = true;
      if (debounceTimer) clearTimeout(debounceTimer);
      listeners.clear();
      await watcher?.close();
      await refreshInFlight;
    },
  };

  if (options.watch !== false) {
    watcher = await createWatcher(
      projectRoot,
      options.additionalIgnoredDirectoryNames ?? [],
      scheduleRefresh,
      (error) =>
        emit({
          type: "error",
          revision: state.revision,
          message: `File watcher failed: ${errorMessage(error)}`,
        }),
    );
  }

  return service;

  function scheduleRefresh(): void {
    if (closed) return;
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      debounceTimer = undefined;
      void refresh();
    }, debounceMs);
  }

  function refresh(): Promise<SnapshotState> {
    if (closed) return Promise.resolve(state);

    if (refreshInFlight) {
      refreshRequested = true;
      return refreshInFlight;
    }

    refreshInFlight = runRefreshLoop().finally(() => {
      refreshInFlight = undefined;
    });
    return refreshInFlight;
  }

  async function runRefreshLoop(): Promise<SnapshotState> {
    do {
      refreshRequested = false;

      try {
        const snapshot = await analyzeProjectSnapshot(
          projectRoot,
          analysisOptions,
        );
        state = {
          revision: state.revision + 1,
          snapshot,
        };
        emit({ type: "snapshot", state });
      } catch (error) {
        emit({
          type: "error",
          revision: state.revision,
          message: errorMessage(error),
        });
      }
    } while (refreshRequested && !closed);

    return state;
  }

  function emit(event: SnapshotServiceEvent): void {
    for (const listener of listeners) listener(event);
  }
}

async function createWatcher(
  projectRoot: string,
  additionalIgnoredDirectoryNames: readonly string[],
  onChange: () => void,
  onRuntimeError: (error: unknown) => void,
): Promise<FSWatcher> {
  const watchedProjectRoot = await realpath(projectRoot);
  const gitPaths = await gitStatePaths(watchedProjectRoot);
  const gitPathSet = new Set(gitPaths.map(normalizeAbsolutePath));
  const ignoredDirectories = new Set([
    ...DEFAULT_IGNORED_DIRECTORY_NAMES,
    ...additionalIgnoredDirectoryNames,
  ]);

  try {
    return await startWatcher(false);
  } catch (error) {
    if (!isWatcherResourceLimit(error)) throw error;
    return startWatcher(true);
  }

  async function startWatcher(usePolling: boolean): Promise<FSWatcher> {
    const watcher = watch([watchedProjectRoot, ...gitPaths], {
      ignoreInitial: true,
      usePolling,
      ignored(filePath, stats) {
        const absolutePath = normalizeAbsolutePath(filePath);
        if (
          isGitStatePath(absolutePath, gitPathSet) ||
          [...gitPathSet].some((gitPath) =>
            gitPath.startsWith(`${absolutePath}${path.sep}`),
          )
        ) {
          return false;
        }

        const relativePath = path.relative(watchedProjectRoot, absolutePath);
        if (
          relativePath === ".." ||
          relativePath.startsWith(`..${path.sep}`) ||
          path.isAbsolute(relativePath)
        ) {
          return true;
        }
        if (!relativePath) return false;

        const segments = relativePath.split(path.sep);
        if (segments.some((segment) => ignoredDirectories.has(segment))) {
          return true;
        }
        if (!stats || stats.isDirectory()) return false;

        return !isWatchedProjectFile(relativePath);
      },
    });

    watcher.on("all", (_eventName, filePath) => {
      const absolutePath = normalizeAbsolutePath(filePath);
      if (isGitStatePath(absolutePath, gitPathSet)) {
        onChange();
        return;
      }

      const relativePath = path.relative(watchedProjectRoot, absolutePath);
      if (isWatchedProjectFile(relativePath)) onChange();
    });

    await waitUntilReady(watcher, onRuntimeError);
    return watcher;
  }
}

function waitUntilReady(
  watcher: FSWatcher,
  onRuntimeError: (error: unknown) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    let settled = false;

    watcher.once("ready", () => {
      if (settled) return;
      settled = true;
      resolve();
    });
    watcher.on("error", (error) => {
      if (settled) {
        onRuntimeError(error);
        return;
      }
      settled = true;
      void watcher.close().finally(() => reject(error));
    });
  });
}

function isWatcherResourceLimit(error: unknown): boolean {
  if (!error || typeof error !== "object" || !("code" in error)) {
    return false;
  }

  return error.code === "EMFILE" || error.code === "ENOSPC";
}

async function gitStatePaths(projectRoot: string): Promise<string[]> {
  try {
    const results = await Promise.all(
      ["index", "HEAD", "refs", "packed-refs"].map((gitPath) =>
        runGit(
          ["rev-parse", "--path-format=absolute", "--git-path", gitPath],
          projectRoot,
        ),
      ),
    );

    return results
      .filter(({ exitCode }) => exitCode === 0)
      .map(({ stdout }) => stdout.toString("utf8").trim())
      .filter(Boolean);
  } catch {
    return [];
  }
}

function isGitStatePath(
  absolutePath: string,
  gitPaths: ReadonlySet<string>,
): boolean {
  return [...gitPaths].some(
    (gitPath) =>
      absolutePath === gitPath ||
      absolutePath.startsWith(`${gitPath}${path.sep}`),
  );
}

function isWatchedProjectFile(filePath: string): boolean {
  const name = path.basename(filePath);
  return (
    watchedConfigurationNames.has(name) ||
    supportedExtensions.has(path.extname(name).toLowerCase())
  );
}

function validatedDebounce(debounceMs: number | undefined): number {
  if (debounceMs === undefined) return 75;
  if (!Number.isFinite(debounceMs) || debounceMs < 0) {
    throw new RangeError("debounceMs must be a non-negative number");
  }
  return debounceMs;
}

function normalizeAbsolutePath(filePath: string): string {
  return path.normalize(path.resolve(filePath));
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
