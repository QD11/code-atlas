import { readFile } from "node:fs/promises";
import path from "node:path";
import { compareExportedSymbols } from "~/analyzer/compare-exported-symbols.js";
import { detectGitChanges } from "~/analyzer/detect-git-changes.js";
import { extractExportedSymbols } from "~/analyzer/extract-exported-symbols.js";
import { runGit } from "~/analyzer/git/run-git.js";
import type {
  AnalyzeExportChangesResult,
  ChangedFileExportAnalysis,
  ExportComparisonDiagnostic,
  ExportComparisonVersion,
} from "~/shared/exported-symbol-change.js";
import type { SourceFileChange } from "~/shared/file-change.js";
import type { ExportedSymbol } from "~/shared/exported-symbol.js";

export interface AnalyzeExportChangesOptions {
  /**
   * Limits simultaneous reads from the working tree and Git object database.
   *
   * @default 32
   */
  maxConcurrency?: number;
}

interface LoadedVersion {
  exports: ExportedSymbol[];
  diagnostics: ExportComparisonDiagnostic[];
}

const DEFAULT_MAX_CONCURRENCY = 32;

export async function analyzeExportChanges(
  projectRoot: string,
  options: AnalyzeExportChangesOptions = {},
): Promise<AnalyzeExportChangesResult> {
  const maxConcurrency = validatedConcurrency(options.maxConcurrency);
  const git = await detectGitChanges(projectRoot);
  const diagnostics: ExportComparisonDiagnostic[] = [];

  if (!git.repositoryRoot || !git.headCommit) {
    return { git, files: [], diagnostics };
  }

  const repositoryRoot = git.repositoryRoot;
  const headCommit = git.headCommit;
  const files = await mapInBatches(
    git.changes,
    maxConcurrency,
    async (fileChange): Promise<ChangedFileExportAnalysis> => {
      const [head, working] = await Promise.all([
        loadHeadVersion(
          repositoryRoot,
          headCommit,
          git.projectRoot,
          fileChange,
        ),
        loadWorkingVersion(git.projectRoot, fileChange),
      ]);

      diagnostics.push(...head.diagnostics, ...working.diagnostics);

      return {
        fileChange,
        headExports: head.exports,
        workingExports: working.exports,
        exportedSymbolChanges: compareExportedSymbols(
          head.exports,
          working.exports,
        ),
      };
    },
  );

  return {
    git,
    files,
    diagnostics: diagnostics.toSorted(compareDiagnostics),
  };
}

async function loadHeadVersion(
  repositoryRoot: string,
  headCommit: string,
  projectRoot: string,
  fileChange: SourceFileChange,
): Promise<LoadedVersion> {
  if (fileChange.status === "added") return emptyVersion();

  const sourceFile =
    fileChange.status === "renamed"
      ? fileChange.previousPath
      : fileChange.path;
  const repositoryPath = repositoryRelativePath(
    repositoryRoot,
    projectRoot,
    sourceFile,
  );

  try {
    const result = await runGit(
      ["show", `${headCommit}:${repositoryPath}`],
      repositoryRoot,
    );

    if (result.exitCode !== 0) {
      return failedRead(
        "head",
        sourceFile,
        result.stderr.trim() ||
          `Git exited with code ${result.exitCode}`,
      );
    }

    return extractVersion(sourceFile, result.stdout.toString("utf8"), "head");
  } catch (error) {
    return failedRead("head", sourceFile, errorMessage(error));
  }
}

async function loadWorkingVersion(
  projectRoot: string,
  fileChange: SourceFileChange,
): Promise<LoadedVersion> {
  if (fileChange.status === "deleted") return emptyVersion();

  try {
    const sourceText = await readFile(
      path.join(projectRoot, fileChange.path),
      "utf8",
    );
    return extractVersion(fileChange.path, sourceText, "working");
  } catch (error) {
    return failedRead("working", fileChange.path, errorMessage(error));
  }
}

function extractVersion(
  sourceFile: string,
  sourceText: string,
  version: ExportComparisonVersion,
): LoadedVersion {
  try {
    const result = extractExportedSymbols(sourceFile, sourceText);
    return {
      exports: result.exports,
      diagnostics: result.diagnostics.map((diagnostic) => ({
        ...diagnostic,
        phase: "parse",
        version,
        sourceFile,
      })),
    };
  } catch (error) {
    return {
      exports: [],
      diagnostics: [
        {
          severity: "error",
          phase: "parse",
          version,
          sourceFile,
          message: `Could not extract exported symbols: ${errorMessage(error)}`,
        },
      ],
    };
  }
}

function failedRead(
  version: ExportComparisonVersion,
  sourceFile: string,
  detail: string,
): LoadedVersion {
  return {
    exports: [],
    diagnostics: [
      {
        severity: "error",
        phase: "read",
        version,
        sourceFile,
        message: `Could not read ${version} version: ${detail}`,
      },
    ],
  };
}

function emptyVersion(): LoadedVersion {
  return { exports: [], diagnostics: [] };
}

function repositoryRelativePath(
  repositoryRoot: string,
  projectRoot: string,
  sourceFile: string,
): string {
  const absoluteFile = path.resolve(projectRoot, sourceFile);
  const relativePath = path.relative(repositoryRoot, absoluteFile);

  if (
    relativePath === ".." ||
    relativePath.startsWith(`..${path.sep}`) ||
    path.isAbsolute(relativePath)
  ) {
    throw new Error(`Source file is outside the Git repository: ${sourceFile}`);
  }

  return relativePath.split(path.sep).join("/");
}

function validatedConcurrency(maxConcurrency: number | undefined): number {
  if (maxConcurrency === undefined) return DEFAULT_MAX_CONCURRENCY;

  if (!Number.isInteger(maxConcurrency) || maxConcurrency < 1) {
    throw new RangeError("maxConcurrency must be a positive integer");
  }

  return maxConcurrency;
}

async function mapInBatches<Input, Output>(
  items: readonly Input[],
  batchSize: number,
  mapper: (item: Input) => Promise<Output>,
): Promise<Output[]> {
  const results: Output[] = [];

  for (let index = 0; index < items.length; index += batchSize) {
    results.push(
      ...(await Promise.all(items.slice(index, index + batchSize).map(mapper))),
    );
  }

  return results;
}

function compareDiagnostics(
  left: ExportComparisonDiagnostic,
  right: ExportComparisonDiagnostic,
): number {
  return (
    compareText(left.sourceFile, right.sourceFile) ||
    compareText(left.version, right.version) ||
    compareText(left.phase, right.phase) ||
    compareText(left.message, right.message)
  );
}

function compareText(left: string, right: string): number {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
