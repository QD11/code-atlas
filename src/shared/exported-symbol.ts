import type { ModuleParseDiagnosticSeverity } from "./module-reference.js";

export type ExportedSymbolKind =
  | "function"
  | "class"
  | "variable"
  | "interface"
  | "type"
  | "enum"
  | "default"
  | "re-export"
  | "namespace-re-export"
  | "star-re-export"
  | "unknown";

export type ExportedSymbolOrigin =
  | "declaration"
  | "local-export"
  | "default"
  | "re-export"
  | "commonjs";

export interface ExportedSymbol {
  /**
   * Public name visible to importing files.
   */
  name: string;
  kind: ExportedSymbolKind;
  origin: ExportedSymbolOrigin;
  localName?: string;
  importedName?: string;
  source?: string;
  isDefault: boolean;
  isTypeOnly: boolean;
  /**
   * CommonJS export assignments are inferred because `module` and `exports`
   * can be shadowed. ESM and TypeScript exports are confirmed.
   */
  certainty: "confirmed" | "inferred";
  /**
   * SHA-256 of the normalized export structure.
   */
  fingerprint: string;
}

export interface ExportedSymbolDiagnostic {
  severity: ModuleParseDiagnosticSeverity;
  message: string;
}

export interface ExtractExportedSymbolsResult {
  exports: ExportedSymbol[];
  diagnostics: ExportedSymbolDiagnostic[];
}
