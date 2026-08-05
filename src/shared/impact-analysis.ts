import type { ExportedSymbolChangeStatus } from "./exported-symbol-change.js";

export type FileImpactLevel =
  "direct-change" | "direct-impact" | "transitive-impact";

export interface ChangedExportOrigin {
  id: string;
  filePath: string;
  name: string;
  status: ExportedSymbolChangeStatus;
  isTypeOnly: boolean;
  certainty: "confirmed" | "inferred";
}

export interface FileImpactReason {
  level: FileImpactLevel;
  origin: ChangedExportOrigin;
  /**
   * Import edge that establishes this step. Direct changes do not have one.
   */
  edgeId?: string;
  /**
   * File one step closer to the originating changed export.
   */
  viaFile?: string;
  distance: number;
  certainty: "confirmed" | "inferred";
}

export interface FileImpact {
  fileId: string;
  levels: FileImpactLevel[];
  reasons: FileImpactReason[];
}

export interface EdgeImpact {
  edgeId: string;
  directChanges: ChangedExportOrigin[];
  transitiveOrigins: ChangedExportOrigin[];
}

export interface ChangeImpactAnalysis {
  files: FileImpact[];
  edges: EdgeImpact[];
}
