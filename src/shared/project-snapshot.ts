import type {
  ChangedFileExportAnalysis,
  ExportComparisonDiagnostic,
} from "./exported-symbol-change.js";
import type {
  GitChangeDiagnostic,
  SourceFileChangeStatus,
} from "./file-change.js";
import type {
  EdgeImpact,
  FileImpactLevel,
  FileImpactReason,
} from "./impact-analysis.js";
import type { FileNode } from "./file-node.js";
import type {
  ProjectAnalysisDiagnostic,
  ProjectGraphEdge,
} from "./project-graph.js";

export interface ProjectSnapshotNode extends FileNode {
  exists: boolean;
  changeStatus?: SourceFileChangeStatus;
  previousPath?: string;
  changedExports: ChangedFileExportAnalysis["exportedSymbolChanges"];
  impactLevels: FileImpactLevel[];
  impactReasons: FileImpactReason[];
}

export interface ProjectSnapshotEdge extends ProjectGraphEdge {
  /**
   * True when the relationship is recovered using a deleted or renamed
   * historical target. Recovered relationships are always inferred.
   */
  historical: boolean;
  impact?: EdgeImpact;
}

export interface ProjectSnapshotDiagnostics {
  project: ProjectAnalysisDiagnostic[];
  git: GitChangeDiagnostic[];
  exports: ExportComparisonDiagnostic[];
}

export interface ProjectSnapshot {
  projectRoot: string;
  headCommit?: string;
  hasChanges: boolean;
  hasExportChanges: boolean;
  graph: {
    nodes: ProjectSnapshotNode[];
    edges: ProjectSnapshotEdge[];
  };
  changedFiles: ChangedFileExportAnalysis[];
  diagnostics: ProjectSnapshotDiagnostics;
}
