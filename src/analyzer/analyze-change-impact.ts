import type {
  AnalyzeExportChangesResult,
  ChangedFileExportAnalysis,
  ExportedSymbolChange,
} from "~/shared/exported-symbol-change.js";
import type {
  ChangeImpactAnalysis,
  ChangedExportOrigin,
  EdgeImpact,
  FileImpact,
  FileImpactLevel,
  FileImpactReason,
} from "~/shared/impact-analysis.js";
import type {
  ImportBinding,
  ModuleReference,
  ReExportBinding,
} from "~/shared/module-reference.js";
import type {
  ProjectGraph,
  ProjectGraphEdge,
} from "~/shared/project-graph.js";

export interface AnalyzeChangeImpactOptions {
  /**
   * Includes downstream files beyond exact direct importers.
   *
   * @default true
   */
  includeTransitive?: boolean;
}

interface DirectEdgeMatch {
  origin: ChangedExportOrigin;
  certainty: "confirmed" | "inferred";
}

interface TraversalStep {
  fileId: string;
  origin: ChangedExportOrigin;
  distance: number;
}

export function analyzeChangeImpact(
  graph: ProjectGraph,
  exportChanges: AnalyzeExportChangesResult,
  options: AnalyzeChangeImpactOptions = {},
): ChangeImpactAnalysis {
  const fileImpacts = new Map<string, FileImpact>();
  const edgeImpacts = new Map<string, EdgeImpact>();
  const originsByTarget = changedOriginsByTarget(exportChanges.files);

  addDirectChanges(fileImpacts, exportChanges.files);

  for (const edge of graph.edges) {
    const origins = originsByTarget.get(edge.target);
    if (!origins) continue;

    const matches = directMatches(edge, origins);
    if (matches.length === 0) continue;

    const edgeImpact = getOrCreateEdgeImpact(edgeImpacts, edge.id);
    for (const match of matches) {
      addUniqueOrigin(edgeImpact.directChanges, match.origin);
      addFileReason(fileImpacts, edge.source, {
        level: "direct-impact",
        origin: match.origin,
        edgeId: edge.id,
        viaFile: edge.target,
        distance: 1,
        certainty: match.certainty,
      });
    }
  }

  if (options.includeTransitive !== false) {
    addTransitiveImpacts(graph, fileImpacts, edgeImpacts);
  }

  return {
    files: [...fileImpacts.values()]
      .map(sortFileImpact)
      .toSorted((left, right) => compareText(left.fileId, right.fileId)),
    edges: [...edgeImpacts.values()]
      .map(sortEdgeImpact)
      .toSorted((left, right) => compareText(left.edgeId, right.edgeId)),
  };
}

function changedOriginsByTarget(
  files: readonly ChangedFileExportAnalysis[],
): Map<string, ChangedExportOrigin[]> {
  const originsByTarget = new Map<string, ChangedExportOrigin[]>();

  for (const file of files) {
    for (const change of file.exportedSymbolChanges) {
      const origin = changedExportOrigin(file, change);
      for (const target of sourcePaths(file)) {
        const origins = originsByTarget.get(target);
        if (origins) {
          addUniqueOrigin(origins, origin);
        } else {
          originsByTarget.set(target, [origin]);
        }
      }
    }
  }

  return originsByTarget;
}

function addDirectChanges(
  fileImpacts: Map<string, FileImpact>,
  files: readonly ChangedFileExportAnalysis[],
): void {
  for (const file of files) {
    for (const change of file.exportedSymbolChanges) {
      const origin = changedExportOrigin(file, change);
      addFileReason(fileImpacts, file.fileChange.path, {
        level: "direct-change",
        origin,
        distance: 0,
        certainty: origin.certainty,
      });
    }
  }
}

function directMatches(
  edge: ProjectGraphEdge,
  origins: readonly ChangedExportOrigin[],
): DirectEdgeMatch[] {
  const matchByOrigin = new Map<string, DirectEdgeMatch>();

  for (const reference of edge.references) {
    for (const origin of origins) {
      if (!referenceCarriesExport(reference, origin.name)) continue;

      const certainty =
        edge.certainty === "confirmed" &&
        reference.certainty === "confirmed" &&
        origin.certainty === "confirmed"
          ? "confirmed"
          : "inferred";
      const existing = matchByOrigin.get(origin.id);

      if (!existing || certainty === "confirmed") {
        matchByOrigin.set(origin.id, { origin, certainty });
      }
    }
  }

  return [...matchByOrigin.values()];
}

function referenceCarriesExport(
  reference: ModuleReference,
  exportName: string,
): boolean {
  switch (reference.kind) {
    case "import":
      return reference.bindings.some((binding) =>
        importBindingMatches(binding, exportName),
      );
    case "import-equals":
      return reference.bindings.some((binding) =>
        importBindingMatches(binding, exportName),
      );
    case "re-export":
      return reference.bindings.some((binding) =>
        reExportBindingMatches(binding, exportName),
      );
    case "dynamic-import":
    case "require":
      return true;
  }
}

function importBindingMatches(
  binding: ImportBinding,
  exportName: string,
): boolean {
  return (
    binding.kind === "namespace" ||
    binding.importedName === "*" ||
    binding.importedName === exportName
  );
}

function reExportBindingMatches(
  binding: ReExportBinding,
  exportName: string,
): boolean {
  if (binding.kind === "namespace") return true;
  if (binding.kind === "star") return exportName !== "default";
  return binding.importedName === exportName;
}

function addTransitiveImpacts(
  graph: ProjectGraph,
  fileImpacts: Map<string, FileImpact>,
  edgeImpacts: Map<string, EdgeImpact>,
): void {
  const incomingEdges = edgesByTarget(graph.edges);
  const directSteps: TraversalStep[] = [];

  for (const impact of fileImpacts.values()) {
    for (const reason of impact.reasons) {
      if (reason.level !== "direct-impact") continue;
      directSteps.push({
        fileId: impact.fileId,
        origin: reason.origin,
        distance: 1,
      });
    }
  }

  for (const directStep of directSteps) {
    const visited = new Set<string>([
      directStep.origin.filePath,
      directStep.fileId,
    ]);
    const queue = [directStep];

    for (let index = 0; index < queue.length; index += 1) {
      const current = queue[index];
      if (!current) continue;

      for (const edge of incomingEdges.get(current.fileId) ?? []) {
        if (visited.has(edge.source)) continue;
        visited.add(edge.source);

        const nextDistance = current.distance + 1;
        addFileReason(fileImpacts, edge.source, {
          level: "transitive-impact",
          origin: current.origin,
          edgeId: edge.id,
          viaFile: current.fileId,
          distance: nextDistance,
          certainty: "inferred",
        });

        const edgeImpact = getOrCreateEdgeImpact(edgeImpacts, edge.id);
        addUniqueOrigin(edgeImpact.transitiveOrigins, current.origin);
        queue.push({
          fileId: edge.source,
          origin: current.origin,
          distance: nextDistance,
        });
      }
    }
  }
}

function edgesByTarget(
  edges: readonly ProjectGraphEdge[],
): Map<string, ProjectGraphEdge[]> {
  const incomingEdges = new Map<string, ProjectGraphEdge[]>();

  for (const edge of edges) {
    const matchingEdges = incomingEdges.get(edge.target);
    if (matchingEdges) {
      matchingEdges.push(edge);
    } else {
      incomingEdges.set(edge.target, [edge]);
    }
  }

  return incomingEdges;
}

function changedExportOrigin(
  file: ChangedFileExportAnalysis,
  change: ExportedSymbolChange,
): ChangedExportOrigin {
  const symbol = change.after ?? change.before;
  if (!symbol) {
    throw new Error(`Changed export "${change.name}" has no symbol data`);
  }

  const namespace = symbol.isTypeOnly ? "type" : "value";
  return {
    id: [
      file.fileChange.path,
      change.name,
      namespace,
      change.status,
    ].join("\0"),
    filePath: file.fileChange.path,
    name: change.name,
    status: change.status,
    isTypeOnly: symbol.isTypeOnly,
    certainty: symbol.certainty,
  };
}

function sourcePaths(file: ChangedFileExportAnalysis): string[] {
  return file.fileChange.status === "renamed"
    ? [file.fileChange.path, file.fileChange.previousPath]
    : [file.fileChange.path];
}

function addFileReason(
  fileImpacts: Map<string, FileImpact>,
  fileId: string,
  reason: FileImpactReason,
): void {
  let impact = fileImpacts.get(fileId);
  if (!impact) {
    impact = { fileId, levels: [], reasons: [] };
    fileImpacts.set(fileId, impact);
  }

  if (!impact.levels.includes(reason.level)) {
    impact.levels.push(reason.level);
  }

  const existing = impact.reasons.find(
    (candidate) =>
      candidate.level === reason.level &&
      candidate.origin.id === reason.origin.id &&
      candidate.edgeId === reason.edgeId,
  );
  if (!existing) impact.reasons.push(reason);
}

function getOrCreateEdgeImpact(
  edgeImpacts: Map<string, EdgeImpact>,
  edgeId: string,
): EdgeImpact {
  const existing = edgeImpacts.get(edgeId);
  if (existing) return existing;

  const impact: EdgeImpact = {
    edgeId,
    directChanges: [],
    transitiveOrigins: [],
  };
  edgeImpacts.set(edgeId, impact);
  return impact;
}

function addUniqueOrigin(
  origins: ChangedExportOrigin[],
  origin: ChangedExportOrigin,
): void {
  if (!origins.some((candidate) => candidate.id === origin.id)) {
    origins.push(origin);
  }
}

function sortFileImpact(impact: FileImpact): FileImpact {
  return {
    ...impact,
    levels: impact.levels.toSorted(compareImpactLevels),
    reasons: impact.reasons.toSorted(
      (left, right) =>
        left.distance - right.distance ||
        compareText(left.origin.id, right.origin.id) ||
        compareText(left.edgeId ?? "", right.edgeId ?? ""),
    ),
  };
}

function sortEdgeImpact(impact: EdgeImpact): EdgeImpact {
  return {
    ...impact,
    directChanges: impact.directChanges.toSorted((left, right) =>
      compareText(left.id, right.id),
    ),
    transitiveOrigins: impact.transitiveOrigins.toSorted((left, right) =>
      compareText(left.id, right.id),
    ),
  };
}

function compareImpactLevels(
  left: FileImpactLevel,
  right: FileImpactLevel,
): number {
  const order: Record<FileImpactLevel, number> = {
    "direct-change": 0,
    "direct-impact": 1,
    "transitive-impact": 2,
  };
  return order[left] - order[right];
}

function compareText(left: string, right: string): number {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}
