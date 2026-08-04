import {
  parseSync,
  type ExportAllDeclaration,
  type ExportDefaultDeclaration,
  type ExportNamedDeclaration,
  type ExportSpecifier,
  type ModuleExportName,
  type OxcError,
  type TSExportAssignment,
} from "oxc-parser";
import { createStructuralFingerprint } from "~/analyzer/create-structural-fingerprint.js";
import {
  collectImportedBindings,
  collectLocalDeclarations,
  declarationRecords,
} from "~/analyzer/exported-symbol/collect-bindings.js";
import {
  defaultDeclarationKind,
  defaultExpressionKind,
} from "~/analyzer/exported-symbol/export-kind.js";
import { extractCommonJsExports } from "~/analyzer/exported-symbol/extract-commonjs-exports.js";
import type {
  ImportedBinding,
  LocalDeclarationRecord,
  PositionedExport,
} from "~/analyzer/exported-symbol/types.js";
import type {
  ExportedSymbol,
  ExportedSymbolDiagnostic,
  ExtractExportedSymbolsResult,
} from "~/shared/exported-symbol.js";

export function extractExportedSymbols(
  filePath: string,
  sourceText: string,
): ExtractExportedSymbolsResult {
  const parsed = parseSync(filePath, sourceText, {
    preserveParens: false,
    sourceType: "unambiguous",
  });
  const diagnostics = parsed.errors.map(exportedSymbolDiagnostic);
  const localDeclarations = collectLocalDeclarations(parsed.program);
  const importedBindings = collectImportedBindings(parsed.program);
  const positionedExports: PositionedExport[] = [];

  for (const statement of parsed.program.body) {
    switch (statement.type) {
      case "ExportNamedDeclaration":
        extractNamedDeclaration(
          statement,
          localDeclarations,
          importedBindings,
          positionedExports,
          diagnostics,
        );
        break;
      case "ExportDefaultDeclaration":
        positionedExports.push({
          position: statement.start,
          symbol: defaultExportSymbol(statement, localDeclarations),
        });
        break;
      case "ExportAllDeclaration":
        positionedExports.push({
          position: statement.start,
          symbol: exportAllSymbol(statement),
        });
        break;
      case "TSExportAssignment":
        positionedExports.push({
          position: statement.start,
          symbol: exportAssignmentSymbol(statement, localDeclarations),
        });
        break;
    }
  }

  positionedExports.push(
    ...extractCommonJsExports(
      parsed.program,
      sourceText,
      localDeclarations,
      diagnostics,
    ),
  );

  return {
    exports: uniqueExports(positionedExports),
    diagnostics,
  };
}

function extractNamedDeclaration(
  declaration: ExportNamedDeclaration,
  localDeclarations: ReadonlyMap<string, LocalDeclarationRecord[]>,
  importedBindings: ReadonlyMap<string, ImportedBinding>,
  exports: PositionedExport[],
  diagnostics: ExportedSymbolDiagnostic[],
): void {
  if (declaration.declaration) {
    const records = declarationRecords(declaration.declaration);

    if (records.length === 0) {
      diagnostics.push({
        severity: "warning",
        message: `Unsupported exported declaration "${declaration.declaration.type}"`,
      });
    }

    for (const record of records) {
      exports.push({
        position: record.position,
        symbol: localExportSymbol(
          record.name,
          record.name,
          "declaration",
          declaration.exportKind === "type",
          localDeclarations,
        ),
      });
    }
  }

  for (const specifier of declaration.specifiers) {
    extractNamedSpecifier(
      declaration,
      specifier,
      localDeclarations,
      importedBindings,
      exports,
      diagnostics,
    );
  }
}

function extractNamedSpecifier(
  declaration: ExportNamedDeclaration,
  specifier: ExportSpecifier,
  localDeclarations: ReadonlyMap<string, LocalDeclarationRecord[]>,
  importedBindings: ReadonlyMap<string, ImportedBinding>,
  exports: PositionedExport[],
  diagnostics: ExportedSymbolDiagnostic[],
): void {
  const localName = moduleExportName(specifier.local);
  const exportedName = moduleExportName(specifier.exported);
  const isTypeOnly =
    declaration.exportKind === "type" || specifier.exportKind === "type";

  if (declaration.source) {
    exports.push({
      position: specifier.start,
      symbol: reExportSymbol(
        exportedName,
        localName,
        declaration.source.value,
        isTypeOnly,
        reExportStructure(declaration, specifier),
      ),
    });
    return;
  }

  const importedBinding = importedBindings.get(localName);
  if (importedBinding) {
    exports.push({
      position: specifier.start,
      symbol: reExportSymbol(
        exportedName,
        importedBinding.importedName,
        importedBinding.source,
        isTypeOnly || importedBinding.isTypeOnly,
        {
          export: reExportStructure(declaration, specifier),
          import: importedBinding.structure,
        },
      ),
    });
    return;
  }

  const records = localDeclarations.get(localName);
  if (!records || records.length === 0) {
    diagnostics.push({
      severity: "warning",
      message: `Could not find local declaration for exported symbol "${localName}"`,
    });
    exports.push({
      position: specifier.start,
      symbol: {
        name: exportedName,
        kind: "unknown",
        origin: "local-export",
        localName,
        isDefault: exportedName === "default",
        isTypeOnly,
        certainty: "confirmed",
        fingerprint: createStructuralFingerprint(specifier),
      },
    });
    return;
  }

  exports.push({
    position: specifier.start,
    symbol: localExportSymbol(
      exportedName,
      localName,
      "local-export",
      isTypeOnly,
      localDeclarations,
    ),
  });
}

function reExportStructure(
  declaration: ExportNamedDeclaration,
  specifier: ExportSpecifier,
): unknown {
  return {
    specifier,
    attributes: declaration.attributes,
    exportKind: declaration.exportKind,
  };
}

function localExportSymbol(
  exportedName: string,
  localName: string,
  origin: "declaration" | "local-export",
  explicitlyTypeOnly: boolean,
  localDeclarations: ReadonlyMap<string, LocalDeclarationRecord[]>,
): ExportedSymbol {
  const records = localDeclarations.get(localName) ?? [];
  const primaryRecord =
    records.find((record) => !record.isTypeOnly) ?? records[0];
  const isTypeOnly =
    explicitlyTypeOnly ||
    (records.length > 0 && records.every((record) => record.isTypeOnly));

  return {
    name: exportedName,
    kind: primaryRecord?.kind ?? "unknown",
    origin,
    localName,
    isDefault: exportedName === "default",
    isTypeOnly,
    certainty: "confirmed",
    fingerprint: createStructuralFingerprint({
      exportedName,
      localName,
      isTypeOnly,
      declarations: records.map((record) => record.structure),
    }),
  };
}

function reExportSymbol(
  exportedName: string,
  importedName: string,
  source: string,
  isTypeOnly: boolean,
  structure: unknown,
): ExportedSymbol {
  return {
    name: exportedName,
    kind: "re-export",
    origin: "re-export",
    importedName,
    source,
    isDefault: exportedName === "default",
    isTypeOnly,
    certainty: "confirmed",
    fingerprint: createStructuralFingerprint({
      exportedName,
      importedName,
      source,
      isTypeOnly,
      structure,
    }),
  };
}

function defaultExportSymbol(
  declaration: ExportDefaultDeclaration,
  localDeclarations: ReadonlyMap<string, LocalDeclarationRecord[]>,
): ExportedSymbol {
  const exported = declaration.declaration;

  if (exported.type === "Identifier") {
    const records = localDeclarations.get(exported.name);
    if (records && records.length > 0) {
      return {
        ...localExportSymbol(
          "default",
          exported.name,
          "local-export",
          false,
          localDeclarations,
        ),
        origin: "default",
      };
    }
  }

  const declarationKind = defaultDeclarationKind(exported);
  const localName =
    "id" in exported &&
    exported.id &&
    typeof exported.id === "object" &&
    "name" in exported.id
      ? String(exported.id.name)
      : undefined;

  return {
    name: "default",
    kind: declarationKind,
    origin: "default",
    ...(localName ? { localName } : {}),
    isDefault: true,
    isTypeOnly: declarationKind === "interface",
    certainty: "confirmed",
    fingerprint: createStructuralFingerprint(exported),
  };
}

function exportAllSymbol(declaration: ExportAllDeclaration): ExportedSymbol {
  const exportedName = declaration.exported
    ? moduleExportName(declaration.exported)
    : "*";

  return {
    name: exportedName,
    kind: declaration.exported
      ? "namespace-re-export"
      : "star-re-export",
    origin: "re-export",
    importedName: "*",
    source: declaration.source.value,
    isDefault: false,
    isTypeOnly: declaration.exportKind === "type",
    certainty: "confirmed",
    fingerprint: createStructuralFingerprint(declaration),
  };
}

function exportAssignmentSymbol(
  declaration: TSExportAssignment,
  localDeclarations: ReadonlyMap<string, LocalDeclarationRecord[]>,
): ExportedSymbol {
  if (declaration.expression.type === "Identifier") {
    const records = localDeclarations.get(declaration.expression.name);
    if (records && records.length > 0) {
      return {
        ...localExportSymbol(
          "default",
          declaration.expression.name,
          "local-export",
          false,
          localDeclarations,
        ),
        origin: "default",
      };
    }
  }

  return {
    name: "default",
    kind: defaultExpressionKind(declaration.expression),
    origin: "default",
    isDefault: true,
    isTypeOnly: false,
    certainty: "confirmed",
    fingerprint: createStructuralFingerprint(declaration.expression),
  };
}

function uniqueExports(exports: readonly PositionedExport[]): ExportedSymbol[] {
  const exportByIdentity = new Map<string, PositionedExport>();

  for (const positionedExport of exports.toSorted(
    (left, right) =>
      left.position - right.position ||
      compareText(left.symbol.name, right.symbol.name),
  )) {
    const key = exportIdentity(positionedExport.symbol);
    if (!exportByIdentity.has(key)) {
      exportByIdentity.set(key, positionedExport);
    }
  }

  return [...exportByIdentity.values()].map(({ symbol }) => symbol);
}

function exportIdentity(symbol: ExportedSymbol): string {
  return [
    symbol.name,
    symbol.source ?? "",
    symbol.importedName ?? "",
    String(symbol.isDefault),
    String(symbol.isTypeOnly),
  ].join("\0");
}

function moduleExportName(name: ModuleExportName): string {
  return name.type === "Identifier" ? name.name : name.value;
}

function exportedSymbolDiagnostic(
  error: OxcError,
): ExportedSymbolDiagnostic {
  return {
    severity:
      error.severity === "Error"
        ? "error"
        : error.severity === "Warning"
          ? "warning"
          : "advice",
    message: error.message,
  };
}

function compareText(left: string, right: string): number {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}
