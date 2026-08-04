import {
  Visitor,
  type AssignmentExpression,
  type MemberExpression,
  type Program,
} from "oxc-parser";
import { createStructuralFingerprint } from "~/analyzer/create-structural-fingerprint.js";
import { defaultExpressionKind } from "~/analyzer/exported-symbol/export-kind.js";
import type {
  LocalDeclarationRecord,
  PositionedExport,
} from "~/analyzer/exported-symbol/types.js";
import type {
  ExportedSymbolDiagnostic,
  ExportedSymbolKind,
} from "~/shared/exported-symbol.js";

interface CommonJsExportRecord {
  name: string;
  kind: ExportedSymbolKind;
  position: number;
  structure: unknown;
}

interface CommonJsExportTarget {
  name?: string;
  isDynamic: boolean;
}

export function extractCommonJsExports(
  program: Program,
  sourceText: string,
  localDeclarations: ReadonlyMap<string, LocalDeclarationRecord[]>,
  diagnostics: ExportedSymbolDiagnostic[],
): PositionedExport[] {
  if (!sourceText.includes("exports")) return [];

  const recordsByName = new Map<string, CommonJsExportRecord[]>();
  const visitor = new Visitor({
    AssignmentExpression(node) {
      const target = commonJsExportTarget(node);
      if (!target) return;
      if (target.isDynamic) {
        diagnostics.push({
          severity: "warning",
          message:
            "Computed CommonJS export name cannot be determined statically",
        });
        return;
      }

      const exportedName = target.name;
      if (!exportedName || exportedName === "__esModule") return;
      const referencedDeclarations =
        node.right.type === "Identifier"
          ? localDeclarations.get(node.right.name)
          : undefined;
      const referencedRecord =
        referencedDeclarations?.find((record) => !record.isTypeOnly) ??
        referencedDeclarations?.[0];
      const record: CommonJsExportRecord = {
        name: exportedName,
        kind: referencedRecord
          ? referencedRecord.kind
          : exportedName === "default"
            ? defaultExpressionKind(node.right)
            : namedCommonJsKind(node.right),
        position: node.start,
        structure: {
          assignment: node,
          referencedDeclarations: referencedDeclarations?.map(
            (declaration) => declaration.structure,
          ),
        },
      };
      const records = recordsByName.get(exportedName);

      if (records) {
        records.push(record);
      } else {
        recordsByName.set(exportedName, [record]);
      }
    },
  });
  visitor.visit(program);

  return [...recordsByName.values()].map(commonJsExport);
}

function commonJsExport(
  records: readonly CommonJsExportRecord[],
): PositionedExport {
  const firstRecord = records[0];
  const lastRecord = records.at(-1);
  if (!firstRecord || !lastRecord) {
    throw new Error("CommonJS export group unexpectedly had no records");
  }

  return {
    position: firstRecord.position,
    symbol: {
      name: firstRecord.name,
      kind: lastRecord.kind,
      origin: "commonjs",
      isDefault: firstRecord.name === "default",
      isTypeOnly: false,
      certainty: "inferred",
      fingerprint: createStructuralFingerprint(
        records.map((record) => record.structure),
      ),
    },
  };
}

function commonJsExportTarget(
  assignment: AssignmentExpression,
): CommonJsExportTarget | undefined {
  if (assignment.left.type !== "MemberExpression") return undefined;
  if (isModuleExports(assignment.left)) {
    return { name: "default", isDynamic: false };
  }

  if (
    assignment.left.object.type === "Identifier" &&
    assignment.left.object.name === "exports"
  ) {
    const name = staticMemberName(assignment.left);
    return name ? { name, isDynamic: false } : { isDynamic: true };
  }

  if (
    assignment.left.object.type === "MemberExpression" &&
    isModuleExports(assignment.left.object)
  ) {
    const name = staticMemberName(assignment.left);
    return name ? { name, isDynamic: false } : { isDynamic: true };
  }

  return undefined;
}

function isModuleExports(expression: MemberExpression): boolean {
  return (
    expression.object.type === "Identifier" &&
    expression.object.name === "module" &&
    staticMemberName(expression) === "exports"
  );
}

function staticMemberName(expression: MemberExpression): string | undefined {
  if (!expression.computed && expression.property.type === "Identifier") {
    return expression.property.name;
  }

  if (
    expression.computed &&
    expression.property.type === "Literal" &&
    typeof expression.property.value === "string"
  ) {
    return expression.property.value;
  }

  return undefined;
}

function namedCommonJsKind(
  expression: AssignmentExpression["right"],
): ExportedSymbolKind {
  const kind = defaultExpressionKind(expression);
  return kind === "default" ? "variable" : kind;
}
