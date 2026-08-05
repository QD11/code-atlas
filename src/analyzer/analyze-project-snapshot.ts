import { analyzeChangeImpact } from "~/analyzer/analyze-change-impact.js";
import {
  analyzeExportChanges,
  type AnalyzeExportChangesOptions,
} from "~/analyzer/analyze-export-changes.js";
import {
  analyzeProjectGraph,
  type AnalyzeProjectGraphOptions,
} from "~/analyzer/analyze-project-graph.js";
import {
  historicalDeletedNodes,
  recoverHistoricalEdges,
} from "~/analyzer/recover-historical-edges.js";
import type { ChangedFileExportAnalysis } from "~/shared/exported-symbol-change.js";
import type { FileNode } from "~/shared/file-node.js";
import type {
  ChangeImpactAnalysis,
  EdgeImpact,
} from "~/shared/impact-analysis.js";
import type {
  ProjectSnapshot,
  ProjectSnapshotEdge,
  ProjectSnapshotNode,
} from "~/shared/project-snapshot.js";
import type { ProjectGraph, ProjectGraphEdge } from "~/shared/project-graph.js";

export interface AnalyzeProjectSnapshotOptions
  extends AnalyzeProjectGraphOptions, AnalyzeExportChangesOptions {}

export async function analyzeProjectSnapshot(
  projectRoot: string,
  options: AnalyzeProjectSnapshotOptions = {},
): Promise<ProjectSnapshot> {
  const [graphResult, exportChanges] = await Promise.all([
    analyzeProjectGraph(projectRoot, options),
    analyzeExportChanges(projectRoot, options),
  ]);
  const recoveredEdges = recoverHistoricalEdges(graphResult, exportChanges);
  const historicalNodes = historicalDeletedNodes(exportChanges);
  const graph = combinedGraph(
    graphResult.graph,
    historicalNodes,
    recoveredEdges,
  );
  const impact = analyzeChangeImpact(graph, exportChanges);

  return {
    projectRoot: graphResult.projectRoot,
    ...(exportChanges.git.headCommit
      ? { headCommit: exportChanges.git.headCommit }
      : {}),
    hasChanges: exportChanges.git.changes.length > 0,
    hasExportChanges: exportChanges.files.some(
      ({ exportedSymbolChanges }) => exportedSymbolChanges.length > 0,
    ),
    graph: {
      nodes: snapshotNodes(graph.nodes, exportChanges.files, impact),
      edges: snapshotEdges(
        graph.edges,
        historicalOnlyEdgeIds(graphResult.graph.edges, recoveredEdges),
        impact,
      ),
    },
    changedFiles: exportChanges.files,
    diagnostics: {
      project: graphResult.diagnostics,
      git: exportChanges.git.diagnostics,
      exports: exportChanges.diagnostics,
    },
  };
}

function combinedGraph(
  currentGraph: ProjectGraph,
  historicalNodes: readonly FileNode[],
  historicalEdges: readonly ProjectGraphEdge[],
): ProjectGraph {
  const nodeById = new Map(
    [...currentGraph.nodes, ...historicalNodes].map((node) => [node.id, node]),
  );
  const edgeById = new Map(currentGraph.edges.map((edge) => [edge.id, edge]));

  for (const historicalEdge of historicalEdges) {
    const existing = edgeById.get(historicalEdge.id);
    if (existing) {
      existing.references.push(...historicalEdge.references);
    } else {
      edgeById.set(historicalEdge.id, historicalEdge);
    }
  }

  return {
    nodes: [...nodeById.values()].toSorted((left, right) =>
      compareText(left.path, right.path),
    ),
    edges: [...edgeById.values()].toSorted(
      (left, right) =>
        compareText(left.source, right.source) ||
        compareText(left.target, right.target),
    ),
  };
}

function historicalOnlyEdgeIds(
  currentEdges: readonly ProjectGraphEdge[],
  historicalEdges: readonly ProjectGraphEdge[],
): Set<string> {
  const currentIds = new Set(currentEdges.map(({ id }) => id));
  return new Set(
    historicalEdges.filter(({ id }) => !currentIds.has(id)).map(({ id }) => id),
  );
}

function snapshotNodes(
  nodes: readonly FileNode[],
  changedFiles: readonly ChangedFileExportAnalysis[],
  impact: ChangeImpactAnalysis,
): ProjectSnapshotNode[] {
  const changeByPath = new Map(
    changedFiles.map((change) => [change.fileChange.path, change]),
  );
  const impactByFile = new Map(
    impact.files.map((fileImpact) => [fileImpact.fileId, fileImpact]),
  );

  return nodes.map((node) => {
    const change = changeByPath.get(node.path);
    const fileImpact = impactByFile.get(node.id);

    return {
      ...node,
      exists: change?.fileChange.status !== "deleted",
      ...(change
        ? {
            changeStatus: change.fileChange.status,
            ...(change.fileChange.status === "renamed"
              ? { previousPath: change.fileChange.previousPath }
              : {}),
          }
        : {}),
      changedExports: change?.exportedSymbolChanges ?? [],
      impactLevels: fileImpact?.levels ?? [],
      impactReasons: fileImpact?.reasons ?? [],
    };
  });
}

function snapshotEdges(
  edges: readonly ProjectGraphEdge[],
  historicalEdgeIds: ReadonlySet<string>,
  impact: ChangeImpactAnalysis,
): ProjectSnapshotEdge[] {
  const impactByEdge = new Map(
    impact.edges.map((edgeImpact) => [edgeImpact.edgeId, edgeImpact]),
  );

  return edges.map((edge) => ({
    ...edge,
    historical: historicalEdgeIds.has(edge.id),
    ...optionalImpact(impactByEdge.get(edge.id)),
  }));
}

function optionalImpact(
  impact: EdgeImpact | undefined,
): { impact: EdgeImpact } | Record<string, never> {
  return impact ? { impact } : {};
}

function compareText(left: string, right: string): number {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}
