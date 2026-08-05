import type { FileNode } from "./file-node.js";
import type {
  ModuleParseDiagnosticSeverity,
  ModuleReference,
  ModuleReferenceCertainty,
} from "./module-reference.js";
import type { ModuleReferenceResolution } from "./module-reference-resolution.js";

export type ProjectAnalysisPhase =
  "configuration" | "read" | "parse" | "resolution";

export interface ProjectAnalysisDiagnostic {
  phase: ProjectAnalysisPhase;
  severity: ModuleParseDiagnosticSeverity;
  message: string;
  sourceFile?: string;
  specifier?: string;
}

export interface ProjectGraphEdge {
  /**
   * Stable identifier derived from the importing and imported node IDs.
   */
  id: string;
  /**
   * ID of the file node containing the import.
   */
  source: string;
  /**
   * ID of the file node being imported.
   */
  target: string;
  /**
   * Confirmed when at least one statement proves the relationship. A
   * require-only relationship remains inferred because `require` may be
   * shadowed in JavaScript.
   */
  certainty: ModuleReferenceCertainty;
  /**
   * Every import or re-export statement connecting this pair of files.
   */
  references: ModuleReference[];
}

export interface ProjectGraph {
  nodes: FileNode[];
  edges: ProjectGraphEdge[];
}

export interface AnalyzeProjectGraphResult {
  /**
   * Absolute path of the selected project.
   */
  projectRoot: string;
  graph: ProjectGraph;
  /**
   * Includes internal, external, unresolved, and unsupported references.
   */
  moduleResolutions: ModuleReferenceResolution[];
  diagnostics: ProjectAnalysisDiagnostic[];
}
