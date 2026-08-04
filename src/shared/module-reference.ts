export type ImportBindingKind = "default" | "named" | "namespace";

export interface ImportBinding {
  kind: ImportBindingKind;
  importedName: string;
  localName: string;
  isTypeOnly: boolean;
}

export interface ImportReference {
  kind: "import";
  specifier: string;
  bindings: ImportBinding[];
}

export type ReExportBindingKind = "named" | "namespace" | "star";

export interface ReExportBinding {
  kind: ReExportBindingKind;
  importedName: string;
  exportedName: string;
  isTypeOnly: boolean;
}

export interface ReExportReference {
  kind: "re-export";
  specifier: string;
  bindings: ReExportBinding[];
}

export type ModuleReference = ImportReference | ReExportReference;

export type ModuleParseDiagnosticSeverity = "error" | "warning" | "advice";

export interface ModuleParseDiagnostic {
  severity: ModuleParseDiagnosticSeverity;
  message: string;
}

export interface ParseModuleReferencesResult {
  references: ModuleReference[];
  diagnostics: ModuleParseDiagnostic[];
}
