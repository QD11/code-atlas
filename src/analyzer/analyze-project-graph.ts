import { readFile } from "node:fs/promises";
import path from "node:path";
import {
  discoverSourceFiles,
  type DiscoverSourceFilesOptions,
} from "~/analyzer/discover-source-files.js";
import { loadTypeScriptProjectConfig } from "~/analyzer/load-typescript-project-config.js";
import { parseModuleReferences } from "~/analyzer/parse-module-references.js";
import { createModuleResolver } from "~/analyzer/resolve-module-references.js";
import type { FileNode } from "~/shared/file-node.js";
import type {
  ModuleParseDiagnostic,
  ParseModuleReferencesResult,
} from "~/shared/module-reference.js";
import type {
  AnalyzeProjectGraphResult,
  ProjectAnalysisDiagnostic,
  ProjectGraphEdge,
} from "~/shared/project-graph.js";

export interface AnalyzeProjectGraphOptions extends DiscoverSourceFilesOptions {
  /**
   * Limits simultaneous file reads for large projects.
   *
   * @default 32
   */
  maxConcurrency?: number;
}

interface ParsedProjectFile {
  file: FileNode;
  result?: ParseModuleReferencesResult;
  diagnostic?: ProjectAnalysisDiagnostic;
}

const DEFAULT_MAX_CONCURRENCY = 32;

export async function analyzeProjectGraph(
  projectRoot: string,
  options: AnalyzeProjectGraphOptions = {},
): Promise<AnalyzeProjectGraphResult> {
  const absoluteProjectRoot = path.resolve(projectRoot);
  const maxConcurrency = validatedConcurrency(options.maxConcurrency);
  const projectFiles = await discoverSourceFiles(absoluteProjectRoot, {
    additionalIgnoredDirectoryNames:
      options.additionalIgnoredDirectoryNames,
  });
  const projectConfig = loadTypeScriptProjectConfig(absoluteProjectRoot);
  const moduleResolver = createModuleResolver({
    projectRoot: absoluteProjectRoot,
    projectFiles,
    compilerOptions: projectConfig.compilerOptions,
  });
  const parsedFiles = await mapInBatches(
    projectFiles,
    maxConcurrency,
    async (file): Promise<ParsedProjectFile> => {
      let sourceText: string;

      try {
        sourceText = await readFile(
          path.join(absoluteProjectRoot, file.path),
          "utf8",
        );
      } catch (error) {
        return {
          file,
          diagnostic: {
            phase: "read",
            severity: "error",
            message: `Could not read source file: ${errorMessage(error)}`,
            sourceFile: file.path,
          },
        };
      }

      try {
        return {
          file,
          result: parseModuleReferences(file.path, sourceText),
        };
      } catch (error) {
        return {
          file,
          diagnostic: {
            phase: "parse",
            severity: "error",
            message: `Could not parse source file: ${errorMessage(error)}`,
            sourceFile: file.path,
          },
        };
      }
    },
  );

  const diagnostics: ProjectAnalysisDiagnostic[] =
    projectConfig.diagnostics.map((diagnostic) => ({
      ...diagnostic,
      phase: "configuration",
    }));
  const moduleResolutions: AnalyzeProjectGraphResult["moduleResolutions"] = [];
  const edgeById = new Map<string, ProjectGraphEdge>();
  const projectFileByPath = new Map(
    projectFiles.map((file) => [file.path, file]),
  );

  for (const parsedFile of parsedFiles) {
    if (parsedFile.diagnostic) {
      diagnostics.push(parsedFile.diagnostic);
      continue;
    }

    const parseResult = parsedFile.result;
    if (!parseResult) continue;

    diagnostics.push(
      ...parseResult.diagnostics.map((diagnostic) =>
        projectParseDiagnostic(parsedFile.file, diagnostic),
      ),
    );

    const resolutionResult = moduleResolver.resolve(
      parsedFile.file,
      parseResult.references,
    );
    moduleResolutions.push(...resolutionResult.resolutions);
    diagnostics.push(
      ...resolutionResult.diagnostics.map((diagnostic) => ({
        ...diagnostic,
        phase: "resolution" as const,
      })),
    );

    for (const resolution of resolutionResult.resolutions) {
      if (resolution.status !== "internal" || !resolution.targetFile) continue;

      const targetFile = projectFileByPath.get(resolution.targetFile);
      if (!targetFile) {
        throw new Error(
          `Internal module target was not discovered: ${resolution.targetFile}`,
        );
      }

      addInternalEdge(
        edgeById,
        parsedFile.file.id,
        targetFile.id,
        resolution.reference,
      );
    }
  }

  return {
    projectRoot: absoluteProjectRoot,
    graph: {
      nodes: projectFiles,
      edges: [...edgeById.values()].toSorted(
        (left, right) =>
          compareText(left.source, right.source) ||
          compareText(left.target, right.target),
      ),
    },
    moduleResolutions,
    diagnostics,
  };
}

function addInternalEdge(
  edgeById: Map<string, ProjectGraphEdge>,
  source: string,
  target: string,
  reference: ProjectGraphEdge["references"][number],
): void {
  const id = importEdgeId(source, target);
  const existingEdge = edgeById.get(id);

  if (existingEdge) {
    existingEdge.references.push(reference);
    if (reference.certainty === "confirmed") {
      existingEdge.certainty = "confirmed";
    }
    return;
  }

  edgeById.set(id, {
    id,
    source,
    target,
    certainty: reference.certainty,
    references: [reference],
  });
}

function importEdgeId(source: string, target: string): string {
  return `import:${encodeURIComponent(source)}->${encodeURIComponent(target)}`;
}

function projectParseDiagnostic(
  file: FileNode,
  diagnostic: ModuleParseDiagnostic,
): ProjectAnalysisDiagnostic {
  return {
    ...diagnostic,
    phase: "parse",
    sourceFile: file.path,
  };
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

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function compareText(left: string, right: string): number {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}
