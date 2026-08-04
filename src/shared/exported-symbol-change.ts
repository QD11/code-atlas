import type { ExportedSymbol } from "./exported-symbol.js";
import type {
  DetectGitChangesResult,
  SourceFileChange,
} from "./file-change.js";
import type { ModuleParseDiagnosticSeverity } from "./module-reference.js";

export type ExportedSymbolChangeStatus = "added" | "modified" | "removed";

export interface ExportedSymbolChange {
  status: ExportedSymbolChangeStatus;
  /**
   * Public name visible to importing files.
   */
  name: string;
  before?: ExportedSymbol;
  after?: ExportedSymbol;
}

export type ExportComparisonVersion = "head" | "working";

export interface ExportComparisonDiagnostic {
  severity: ModuleParseDiagnosticSeverity;
  phase: "read" | "parse";
  version: ExportComparisonVersion;
  message: string;
  sourceFile: string;
}

export interface ChangedFileExportAnalysis {
  fileChange: SourceFileChange;
  /**
   * Symbols exported by the file at HEAD. Empty for an added file.
   */
  headExports: ExportedSymbol[];
  /**
   * Symbols exported by the working file. Empty for a deleted file.
   */
  workingExports: ExportedSymbol[];
  exportedSymbolChanges: ExportedSymbolChange[];
}

export interface AnalyzeExportChangesResult {
  git: DetectGitChangesResult;
  files: ChangedFileExportAnalysis[];
  diagnostics: ExportComparisonDiagnostic[];
}
