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
  certainty: "confirmed";
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
  certainty: "confirmed";
  bindings: ReExportBinding[];
}

export interface DynamicImportReference {
  kind: "dynamic-import";
  specifier: string;
  certainty: "confirmed";
  bindings: [];
}

export interface RequireReference {
  kind: "require";
  specifier: string;
  certainty: "inferred";
  bindings: [];
}

export interface ImportEqualsReference {
  kind: "import-equals";
  specifier: string;
  certainty: "confirmed";
  bindings: ImportBinding[];
}

export type ModuleReference =
  | ImportReference
  | ReExportReference
  | DynamicImportReference
  | RequireReference
  | ImportEqualsReference;

export type ModuleParseDiagnosticSeverity = "error" | "warning" | "advice";

export interface ModuleParseDiagnostic {
  severity: ModuleParseDiagnosticSeverity;
  message: string;
}

export interface ParseModuleReferencesResult {
  references: ModuleReference[];
  diagnostics: ModuleParseDiagnostic[];
}
