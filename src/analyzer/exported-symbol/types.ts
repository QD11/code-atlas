import type { ExportedSymbol, ExportedSymbolKind } from "~/shared/exported-symbol.js";

export interface LocalDeclarationRecord {
  name: string;
  kind: ExportedSymbolKind;
  isTypeOnly: boolean;
  position: number;
  structure: unknown;
}

export interface ImportedBinding {
  importedName: string;
  source: string;
  isTypeOnly: boolean;
  structure: unknown;
}

export interface PositionedExport {
  position: number;
  symbol: ExportedSymbol;
}
