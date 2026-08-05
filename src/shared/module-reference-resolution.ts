import type { ModuleReference } from "./module-reference.js";

export type ModuleResolutionStatus =
  "internal" | "external" | "unresolved" | "unsupported";

export interface ModuleReferenceResolution {
  sourceFile: string;
  targetFile?: string;
  status: ModuleResolutionStatus;
  reference: ModuleReference;
}

export interface ModuleResolutionDiagnostic {
  severity: "warning";
  message: string;
  sourceFile?: string;
  specifier?: string;
}

export interface ResolveModuleReferencesResult {
  resolutions: ModuleReferenceResolution[];
  diagnostics: ModuleResolutionDiagnostic[];
}
