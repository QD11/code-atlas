import {
  parseSync,
  Visitor,
  type CallExpression,
  type Expression,
  type OxcError,
  type StaticExportEntry,
  type StaticImportEntry,
  type TSImportEqualsDeclaration,
} from "oxc-parser";
import type {
  DynamicImportReference,
  ImportBinding,
  ImportEqualsReference,
  ModuleParseDiagnostic,
  ModuleParseDiagnosticSeverity,
  ModuleReference,
  ParseModuleReferencesResult,
  ReExportBinding,
  RequireReference,
} from "~/shared/module-reference.js";

interface PositionedReference {
  start: number;
  reference: ModuleReference;
}

export function parseModuleReferences(
  filePath: string,
  sourceText: string,
): ParseModuleReferencesResult {
  const parsed = parseSync(filePath, sourceText, {
    sourceType: "unambiguous",
  });

  const references: PositionedReference[] = parsed.module.staticImports.map(
    (statement) => ({
      start: statement.start,
      reference: {
        kind: "import" as const,
        specifier: statement.moduleRequest.value,
        certainty: "confirmed" as const,
        bindings: statement.entries.map(importBinding),
      },
    }),
  );

  references.push(
    ...parsed.module.staticExports.flatMap((statement) => {
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
            certainty: "confirmed" as const,
            bindings: entries.map(reExportBinding),
          },
        },
      ];
    }),
  );

  const diagnostics = parsed.errors.map(moduleParseDiagnostic);

  if (
    parsed.module.dynamicImports.length > 0 ||
    sourceText.includes("require")
  ) {
    const visitor = new Visitor({
      ImportExpression(node) {
        const specifier = staticSpecifier(node.source);

        if (specifier === undefined) {
          diagnostics.push({
            severity: "warning",
            message: "Dynamic import specifier cannot be determined statically",
          });
          return;
        }

        references.push({
          start: node.start,
          reference: dynamicImportReference(specifier),
        });
      },
      CallExpression(node) {
        const specifier = requireSpecifier(node);
        if (specifier === null) return;

        if (specifier === undefined) {
          diagnostics.push({
            severity: "warning",
            message: "Require specifier cannot be determined statically",
          });
          return;
        }

        references.push({
          start: node.start,
          reference: requireReference(specifier),
        });
      },
      TSImportEqualsDeclaration(node) {
        const reference = importEqualsReference(node);
        if (!reference) return;

        references.push({
          start: node.start,
          reference,
        });
      },
    });

    visitor.visit(parsed.program);
  }

  return {
    references: references
      .toSorted((left, right) => left.start - right.start)
      .map(({ reference }) => reference),
    diagnostics,
  };
}

function dynamicImportReference(specifier: string): DynamicImportReference {
  return {
    kind: "dynamic-import",
    specifier,
    certainty: "confirmed",
    bindings: [],
  };
}

function requireReference(specifier: string): RequireReference {
  return {
    kind: "require",
    specifier,
    certainty: "inferred",
    bindings: [],
  };
}

function importEqualsReference(
  node: TSImportEqualsDeclaration,
): ImportEqualsReference | undefined {
  if (node.moduleReference.type !== "TSExternalModuleReference") {
    return undefined;
  }

  return {
    kind: "import-equals",
    specifier: node.moduleReference.expression.value,
    certainty: "confirmed",
    bindings: [
      {
        kind: "namespace",
        importedName: "*",
        localName: node.id.name,
        isTypeOnly: node.importKind === "type",
      },
    ],
  };
}

function requireSpecifier(node: CallExpression): string | undefined | null {
  if (
    node.callee.type !== "Identifier" ||
    node.callee.name !== "require" ||
    node.arguments.length !== 1
  ) {
    return null;
  }

  const argument = node.arguments[0];
  if (!argument || argument.type === "SpreadElement") return undefined;

  return staticSpecifier(argument);
}

function staticSpecifier(expression: Expression): string | undefined {
  if (expression.type === "Literal" && typeof expression.value === "string") {
    return expression.value;
  }

  if (
    expression.type === "TemplateLiteral" &&
    expression.expressions.length === 0
  ) {
    return expression.quasis[0]?.value.cooked ?? undefined;
  }

  return undefined;
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
