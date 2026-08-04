import path from "node:path";
import { loadTypeScriptProjectConfig } from "~/analyzer/load-typescript-project-config.js";
import { createModuleResolver } from "~/analyzer/resolve-module-references.js";
import type { AnalyzeExportChangesResult } from "~/shared/exported-symbol-change.js";
import {
  SUPPORTED_SOURCE_EXTENSIONS,
  type FileNode,
  type SourceFileExtension,
} from "~/shared/file-node.js";
import type {
  AnalyzeProjectGraphResult,
  ProjectGraphEdge,
} from "~/shared/project-graph.js";

interface HistoricalTarget {
  virtualFile: FileNode;
  outputTargetId: string;
}

export function recoverHistoricalEdges(
  graphResult: AnalyzeProjectGraphResult,
  exportChanges: AnalyzeExportChangesResult,
): ProjectGraphEdge[] {
  const historicalTargets = collectHistoricalTargets(exportChanges);
  if (historicalTargets.length === 0) return [];

  const targetByHistoricalPath = new Map(
    historicalTargets.map((target) => [
      target.virtualFile.path,
      target.outputTargetId,
    ]),
  );
  const projectConfig = loadTypeScriptProjectConfig(graphResult.projectRoot);
  const moduleResolver = createModuleResolver({
    projectRoot: graphResult.projectRoot,
    projectFiles: [
      ...graphResult.graph.nodes,
      ...historicalTargets.map(({ virtualFile }) => virtualFile),
    ],
    compilerOptions: projectConfig.compilerOptions,
  });
  const sourceByPath = new Map(
    graphResult.graph.nodes.map((file) => [file.path, file]),
  );
  const recoveredById = new Map<string, ProjectGraphEdge>();

  for (const unresolved of graphResult.moduleResolutions) {
    if (unresolved.status !== "unresolved") continue;

    const sourceFile = sourceByPath.get(unresolved.sourceFile);
    if (!sourceFile) continue;

    const retried = moduleResolver.resolve(sourceFile, [
      unresolved.reference,
    ]).resolutions[0];
    if (retried?.status !== "internal" || !retried.targetFile) continue;

    const outputTargetId = targetByHistoricalPath.get(retried.targetFile);
    if (!outputTargetId) continue;

    addRecoveredEdge(
      recoveredById,
      sourceFile.id,
      outputTargetId,
      unresolved.reference,
    );
  }

  return [...recoveredById.values()].toSorted(
    (left, right) =>
      compareText(left.source, right.source) ||
      compareText(left.target, right.target),
  );
}

export function historicalDeletedNodes(
  exportChanges: AnalyzeExportChangesResult,
): FileNode[] {
  return exportChanges.files
    .filter(({ fileChange }) => fileChange.status === "deleted")
    .map(({ fileChange }) => fileNode(fileChange.path));
}

function collectHistoricalTargets(
  exportChanges: AnalyzeExportChangesResult,
): HistoricalTarget[] {
  return exportChanges.files.flatMap(({ fileChange }) => {
    if (fileChange.status === "deleted") {
      return [
        {
          virtualFile: fileNode(fileChange.path),
          outputTargetId: fileChange.path,
        },
      ];
    }

    if (fileChange.status === "renamed") {
      return [
        {
          virtualFile: fileNode(fileChange.previousPath),
          outputTargetId: fileChange.path,
        },
      ];
    }

    return [];
  });
}

function fileNode(filePath: string): FileNode {
  const extension = path.posix.extname(filePath).toLowerCase();
  if (!isSupportedExtension(extension)) {
    throw new Error(`Unsupported historical source file: ${filePath}`);
  }

  return {
    id: filePath,
    path: filePath,
    name: path.posix.basename(filePath),
    extension,
  };
}

function isSupportedExtension(
  extension: string,
): extension is SourceFileExtension {
  return (SUPPORTED_SOURCE_EXTENSIONS as readonly string[]).includes(
    extension,
  );
}

function addRecoveredEdge(
  edgeById: Map<string, ProjectGraphEdge>,
  source: string,
  target: string,
  reference: ProjectGraphEdge["references"][number],
): void {
  const id = importEdgeId(source, target);
  const existing = edgeById.get(id);
  if (existing) {
    existing.references.push(reference);
    return;
  }

  edgeById.set(id, {
    id,
    source,
    target,
    certainty: "inferred",
    references: [reference],
  });
}

function importEdgeId(source: string, target: string): string {
  return `import:${encodeURIComponent(source)}->${encodeURIComponent(target)}`;
}

function compareText(left: string, right: string): number {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}
