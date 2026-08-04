import {
  parseSync,
  type OxcError,
  type StaticExportEntry,
  type StaticImportEntry,
} from "oxc-parser";
import type {
  ImportBinding,
  ModuleParseDiagnostic,
  ModuleParseDiagnosticSeverity,
  ParseModuleReferencesResult,
  ReExportBinding,
} from "~/shared/module-reference.js";

export function parseModuleReferences(
  filePath: string,
  sourceText: string,
): ParseModuleReferencesResult {
  const parsed = parseSync(filePath, sourceText, {
    sourceType: "unambiguous",
  });

  const imports = parsed.module.staticImports.map((statement) => ({
    start: statement.start,
    reference: {
      kind: "import" as const,
      specifier: statement.moduleRequest.value,
      bindings: statement.entries.map(importBinding),
    },
  }));

  const reExports = parsed.module.staticExports.flatMap((statement) => {
    const entries = statement.entries.filter(
      (entry) => entry.moduleRequest !== null,
    );
    const specifier = entries[0]?.moduleRequest?.value;

    if (!specifier) return [];

    return [
      {
        start: statement.start,
        reference: {
          kind: "re-export" as const,
          specifier,
          bindings: entries.map(reExportBinding),
        },
      },
    ];
  });

  return {
    references: [...imports, ...reExports]
      .toSorted((left, right) => left.start - right.start)
      .map(({ reference }) => reference),
    diagnostics: parsed.errors.map(moduleParseDiagnostic),
  };
}

function importBinding(entry: StaticImportEntry): ImportBinding {
  switch (entry.importName.kind) {
    case "Default":
      return {
        kind: "default",
        importedName: "default",
        localName: entry.localName.value,
        isTypeOnly: entry.isType,
      };
    case "Name":
      return {
        kind: "named",
        importedName: requiredName(entry.importName.name),
        localName: entry.localName.value,
        isTypeOnly: entry.isType,
      };
    case "NamespaceObject":
      return {
        kind: "namespace",
        importedName: "*",
        localName: entry.localName.value,
        isTypeOnly: entry.isType,
      };
  }

  throw new Error(`Unsupported import binding: ${entry.importName.kind}`);
}

function reExportBinding(entry: StaticExportEntry): ReExportBinding {
  switch (entry.importName.kind) {
    case "Name":
      return {
        kind: "named",
        importedName: requiredName(entry.importName.name),
        exportedName: requiredName(entry.exportName.name),
        isTypeOnly: entry.isType,
      };
    case "All":
      return {
        kind: "namespace",
        importedName: "*",
        exportedName: requiredName(entry.exportName.name),
        isTypeOnly: entry.isType,
      };
    case "AllButDefault":
      return {
        kind: "star",
        importedName: "*",
        exportedName: "*",
        isTypeOnly: entry.isType,
      };
    case "None":
      throw new Error("Unexpected re-export without an imported name");
  }

  throw new Error(`Unsupported re-export binding: ${entry.importName.kind}`);
}

function moduleParseDiagnostic(error: OxcError): ModuleParseDiagnostic {
  return {
    severity: diagnosticSeverity(error.severity),
    message: error.message,
  };
}

function diagnosticSeverity(
  severity: OxcError["severity"],
): ModuleParseDiagnosticSeverity {
  switch (severity) {
    case "Error":
      return "error";
    case "Warning":
      return "warning";
    case "Advice":
      return "advice";
  }

  throw new Error(`Unsupported Oxc diagnostic severity: ${severity}`);
}

function requiredName(name: string | null): string {
  if (name === null) {
    throw new Error("Oxc returned a module binding without a name");
  }

  return name;
}
