import path from "node:path";
import { runGit, type GitCommandResult } from "~/analyzer/git/run-git.js";
import { SUPPORTED_SOURCE_EXTENSIONS } from "~/shared/file-node.js";
import type {
  DetectGitChangesResult,
  GitChangeDiagnostic,
  SourceFileChange,
} from "~/shared/file-change.js";

const supportedSourceExtensions = new Set<string>(SUPPORTED_SOURCE_EXTENSIONS);

export async function detectGitChanges(
  projectRoot: string,
): Promise<DetectGitChangesResult> {
  const absoluteProjectRoot = path.resolve(projectRoot);
  let repositoryResult: GitCommandResult;

  try {
    repositoryResult = await runGit(
      ["rev-parse", "--show-toplevel"],
      absoluteProjectRoot,
    );
  } catch (error) {
    return unavailableResult(absoluteProjectRoot, error);
  }

  if (repositoryResult.exitCode !== 0) {
    return {
      projectRoot: absoluteProjectRoot,
      changes: [],
      diagnostics: [
        {
          severity: "error",
          code: "not-git-repository",
          message: "The selected project is not inside a Git repository",
        },
      ],
    };
  }

  const prefixResult = await runGit(
    ["rev-parse", "--show-prefix"],
    absoluteProjectRoot,
  );
  const repositoryPrefix =
    prefixResult.exitCode === 0
      ? normalizeProjectPrefix(prefixResult.stdout)
      : "";
  const repositoryRoot =
    prefixResult.exitCode === 0
      ? repositoryRootFromPrefix(absoluteProjectRoot, prefixResult.stdout)
      : repositoryResult.stdout.toString("utf8").trim();
  const headResult = await runGit(
    ["rev-parse", "--verify", "HEAD"],
    absoluteProjectRoot,
  );

  if (headResult.exitCode !== 0) {
    return {
      projectRoot: absoluteProjectRoot,
      repositoryRoot,
      changes: [],
      diagnostics: [
        {
          severity: "error",
          code: "no-head",
          message: "The Git repository does not have a committed HEAD revision",
        },
      ],
    };
  }

  const headCommit = headResult.stdout.toString("utf8").trim();
  const [trackedResult, untrackedResult, conflictedResult] = await Promise.all([
    runGit(
      [
        "diff",
        "--name-status",
        "--no-ext-diff",
        "--find-renames",
        "--ignore-submodules=all",
        "--relative",
        "-z",
        "HEAD",
        "--",
        ".",
      ],
      absoluteProjectRoot,
    ),
    runGit(
      ["ls-files", "--others", "--exclude-standard", "-z", "--", "."],
      absoluteProjectRoot,
    ),
    runGit(
      ["diff", "--name-only", "--diff-filter=U", "--relative", "-z", "--", "."],
      absoluteProjectRoot,
    ),
  ]);

  const commandFailure = failedChangeCommand(
    absoluteProjectRoot,
    repositoryRoot,
    headCommit,
    trackedResult,
    untrackedResult,
    conflictedResult,
  );
  if (commandFailure) return commandFailure;

  const diagnostics: GitChangeDiagnostic[] = [];
  const trackedChanges = parseTrackedChanges(trackedResult.stdout, diagnostics);
  addConflictedFiles(
    trackedChanges,
    diagnostics,
    nullFields(conflictedResult.stdout),
  );
  const untrackedChanges = nullFields(untrackedResult.stdout)
    .filter(isSupportedSourceFile)
    .map((filePath): SourceFileChange => ({
      status: "added",
      path: normalizeProjectPath(filePath),
    }));
  const changesWithInferredRenames = await inferExactRenames(
    [...trackedChanges, ...untrackedChanges],
    absoluteProjectRoot,
    repositoryPrefix,
    headCommit,
  );

  return {
    projectRoot: absoluteProjectRoot,
    repositoryRoot,
    headCommit,
    changes: coalesceAndSortChanges(changesWithInferredRenames),
    diagnostics,
  };
}

function addConflictedFiles(
  changes: SourceFileChange[],
  diagnostics: GitChangeDiagnostic[],
  filePaths: readonly string[],
): void {
  for (const filePath of filePaths) {
    const normalizedPath = normalizeProjectPath(filePath);
    if (!isSupportedSourceFile(normalizedPath)) continue;

    if (!changes.some((change) => change.path === normalizedPath)) {
      changes.push({
        status: "modified",
        path: normalizedPath,
      });
    }
    if (
      diagnostics.some(
        (diagnostic) =>
          diagnostic.code === "conflicted-file" &&
          diagnostic.path === normalizedPath,
      )
    ) {
      continue;
    }

    diagnostics.push(conflictedFileDiagnostic(normalizedPath));
  }
}

function parseTrackedChanges(
  output: Buffer,
  diagnostics: GitChangeDiagnostic[],
): SourceFileChange[] {
  const fields = nullFields(output);
  const changes: SourceFileChange[] = [];

  for (let index = 0; index < fields.length;) {
    const statusToken = fields[index++];
    if (!statusToken) continue;

    const status = statusToken[0];
    if (status === "R" || status === "C") {
      const previousPath = fields[index++];
      const currentPath = fields[index++];

      if (!previousPath || !currentPath) {
        diagnostics.push(malformedOutputDiagnostic(statusToken));
        break;
      }

      if (status === "R") {
        addRenameChange(changes, previousPath, currentPath);
      } else if (isSupportedSourceFile(currentPath)) {
        changes.push({
          status: "added",
          path: normalizeProjectPath(currentPath),
        });
      }
      continue;
    }

    const filePath = fields[index++];
    if (!filePath) {
      diagnostics.push(malformedOutputDiagnostic(statusToken));
      break;
    }

    const normalizedPath = normalizeProjectPath(filePath);
    if (!isSupportedSourceFile(normalizedPath)) continue;

    switch (status) {
      case "A":
        changes.push({ status: "added", path: normalizedPath });
        break;
      case "M":
      case "T":
        changes.push({ status: "modified", path: normalizedPath });
        break;
      case "D":
        changes.push({ status: "deleted", path: normalizedPath });
        break;
      case "U":
        changes.push({ status: "modified", path: normalizedPath });
        diagnostics.push(conflictedFileDiagnostic(normalizedPath));
        break;
      default:
        diagnostics.push({
          severity: "warning",
          code: "unsupported-git-status",
          message: `Git reported unsupported change status "${statusToken}"`,
          path: normalizedPath,
        });
    }
  }

  return changes;
}

function conflictedFileDiagnostic(filePath: string): GitChangeDiagnostic {
  return {
    severity: "warning",
    code: "conflicted-file",
    message: "The file has unresolved Git conflicts and is treated as modified",
    path: filePath,
  };
}

function addRenameChange(
  changes: SourceFileChange[],
  previousPath: string,
  currentPath: string,
): void {
  const normalizedPreviousPath = normalizeProjectPath(previousPath);
  const normalizedCurrentPath = normalizeProjectPath(currentPath);
  const previousSupported = isSupportedSourceFile(normalizedPreviousPath);
  const currentSupported = isSupportedSourceFile(normalizedCurrentPath);

  if (previousSupported && currentSupported) {
    changes.push({
      status: "renamed",
      path: normalizedCurrentPath,
      previousPath: normalizedPreviousPath,
    });
  } else if (previousSupported) {
    changes.push({
      status: "deleted",
      path: normalizedPreviousPath,
    });
  } else if (currentSupported) {
    changes.push({
      status: "added",
      path: normalizedCurrentPath,
    });
  }
}

function coalesceAndSortChanges(
  changes: readonly SourceFileChange[],
): SourceFileChange[] {
  const changeByPath = new Map<string, SourceFileChange>();

  for (const change of changes) {
    const existingChange = changeByPath.get(change.path);

    if (
      existingChange &&
      ((existingChange.status === "added" && change.status === "deleted") ||
        (existingChange.status === "deleted" && change.status === "added"))
    ) {
      changeByPath.set(change.path, {
        status: "modified",
        path: change.path,
      });
      continue;
    }

    changeByPath.set(change.path, change);
  }

  return [...changeByPath.values()].toSorted(
    (left, right) =>
      compareText(left.path, right.path) ||
      compareText(left.status, right.status),
  );
}

async function inferExactRenames(
  changes: readonly SourceFileChange[],
  projectRoot: string,
  repositoryPrefix: string,
  headCommit: string,
): Promise<SourceFileChange[]> {
  const deletions = changes.filter(
    (change): change is Extract<SourceFileChange, { status: "deleted" }> =>
      change.status === "deleted",
  );
  const additions = changes.filter(
    (change): change is Extract<SourceFileChange, { status: "added" }> =>
      change.status === "added",
  );

  if (deletions.length === 0 || additions.length === 0) return [...changes];

  const [deletedObjectIds, addedObjectIds] = await Promise.all([
    objectIdsInBatches(deletions, async (change) => {
      const result = await runGit(
        [
          "rev-parse",
          "--verify",
          `${headCommit}:${repositoryPrefix}${change.path}`,
        ],
        projectRoot,
      );
      return successfulObjectId(result);
    }),
    objectIdsInBatches(additions, async (change) => {
      const result = await runGit(
        ["hash-object", "--no-filters", "--", change.path],
        projectRoot,
      );
      return successfulObjectId(result);
    }),
  ]);
  const deletedByObjectId = changesByObjectId(deletions, deletedObjectIds);
  const addedByObjectId = changesByObjectId(additions, addedObjectIds);
  const replacedChanges = new Set<SourceFileChange>();
  const inferredRenames: SourceFileChange[] = [];

  for (const [objectId, deletedCandidates] of deletedByObjectId) {
    const addedCandidates = addedByObjectId.get(objectId);
    if (deletedCandidates.length !== 1 || addedCandidates?.length !== 1) {
      continue;
    }

    const [deletedChange] = deletedCandidates;
    const [addedChange] = addedCandidates;
    if (!deletedChange || !addedChange) continue;
    if (deletedChange.path === addedChange.path) continue;

    replacedChanges.add(deletedChange);
    replacedChanges.add(addedChange);
    inferredRenames.push({
      status: "renamed",
      path: addedChange.path,
      previousPath: deletedChange.path,
    });
  }

  return [
    ...changes.filter((change) => !replacedChanges.has(change)),
    ...inferredRenames,
  ];
}

async function objectIdsInBatches<Change extends SourceFileChange>(
  changes: readonly Change[],
  objectId: (change: Change) => Promise<string | undefined>,
): Promise<(string | undefined)[]> {
  const objectIds: (string | undefined)[] = [];
  const batchSize = 32;

  for (let index = 0; index < changes.length; index += batchSize) {
    objectIds.push(
      ...(await Promise.all(
        changes.slice(index, index + batchSize).map(objectId),
      )),
    );
  }

  return objectIds;
}

function changesByObjectId<Change extends SourceFileChange>(
  changes: readonly Change[],
  objectIds: readonly (string | undefined)[],
): Map<string, Change[]> {
  const changesById = new Map<string, Change[]>();

  for (const [index, change] of changes.entries()) {
    const objectId = objectIds[index];
    if (!objectId) continue;

    const matchingChanges = changesById.get(objectId);
    if (matchingChanges) {
      matchingChanges.push(change);
    } else {
      changesById.set(objectId, [change]);
    }
  }

  return changesById;
}

function successfulObjectId(result: GitCommandResult): string | undefined {
  if (result.exitCode !== 0) return undefined;

  const objectId = result.stdout.toString("utf8").trim();
  return objectId || undefined;
}

function isSupportedSourceFile(filePath: string): boolean {
  return supportedSourceExtensions.has(
    path.posix.extname(normalizeProjectPath(filePath)).toLowerCase(),
  );
}

function nullFields(output: Buffer): string[] {
  const fields = output.toString("utf8").split("\0");
  if (fields.at(-1) === "") fields.pop();
  return fields;
}

function normalizeProjectPath(filePath: string): string {
  return filePath.replaceAll("\\", "/").replace(/^\.\//, "");
}

function repositoryRootFromPrefix(projectRoot: string, output: Buffer): string {
  const directoryDepth = output
    .toString("utf8")
    .trim()
    .split("/")
    .filter(Boolean).length;

  return path.resolve(
    projectRoot,
    ...Array.from({ length: directoryDepth }, () => ".."),
  );
}

function normalizeProjectPrefix(output: Buffer): string {
  const prefix = normalizeProjectPath(output.toString("utf8").trim());
  return prefix ? `${prefix.replace(/\/$/, "")}/` : "";
}

function malformedOutputDiagnostic(status: string): GitChangeDiagnostic {
  return {
    severity: "warning",
    code: "malformed-git-output",
    message: `Git returned incomplete change data after status "${status}"`,
  };
}

function failedChangeCommand(
  projectRoot: string,
  repositoryRoot: string,
  headCommit: string,
  ...results: GitCommandResult[]
): DetectGitChangesResult | undefined {
  const failedResult = results.find((result) => result.exitCode !== 0);
  if (!failedResult) return undefined;

  return {
    projectRoot,
    repositoryRoot,
    headCommit,
    changes: [],
    diagnostics: [
      {
        severity: "error",
        code: "git-command-failed",
        message: gitFailureMessage(failedResult),
      },
    ],
  };
}

function unavailableResult(
  projectRoot: string,
  error: unknown,
): DetectGitChangesResult {
  return {
    projectRoot,
    changes: [],
    diagnostics: [
      {
        severity: "error",
        code: "git-unavailable",
        message: `Could not run Git: ${errorMessage(error)}`,
      },
    ],
  };
}

function gitFailureMessage(result: GitCommandResult): string {
  const detail = result.stderr.trim();
  return detail
    ? `Git change detection failed: ${detail}`
    : `Git change detection failed with exit code ${result.exitCode}`;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function compareText(left: string, right: string): number {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}
