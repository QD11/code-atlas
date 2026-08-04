import type {
  BindingPattern,
  BindingRestElement,
  Declaration,
  ImportDeclaration,
  Program,
  TSImportEqualsDeclaration,
  VariableDeclaration,
} from "oxc-parser";
import type {
  ImportedBinding,
  LocalDeclarationRecord,
} from "~/analyzer/exported-symbol/types.js";
import type { ExportedSymbolKind } from "~/shared/exported-symbol.js";

export function collectLocalDeclarations(
  program: Program,
): ReadonlyMap<string, LocalDeclarationRecord[]> {
  const recordsByName = new Map<string, LocalDeclarationRecord[]>();

  for (const statement of program.body) {
    const declaration =
      statement.type === "ExportNamedDeclaration"
        ? statement.declaration
        : topLevelDeclaration(statement);
    if (!declaration) continue;

    for (const record of declarationRecords(declaration)) {
      const existingRecords = recordsByName.get(record.name);
      if (existingRecords) {
        existingRecords.push(record);
      } else {
        recordsByName.set(record.name, [record]);
      }
    }
  }

  return recordsByName;
}

export function declarationRecords(
  declaration: Declaration,
): LocalDeclarationRecord[] {
  switch (declaration.type) {
    case "VariableDeclaration":
      return variableDeclarationRecords(declaration);
    case "FunctionDeclaration":
    case "TSDeclareFunction":
      return declaration.id
        ? [
            declarationRecord(
              declaration.id.name,
              "function",
              false,
              declaration.start,
              declaration,
            ),
          ]
        : [];
    case "ClassDeclaration":
      return declaration.id
        ? [
            declarationRecord(
              declaration.id.name,
              "class",
              false,
              declaration.start,
              declaration,
            ),
          ]
        : [];
    case "TSInterfaceDeclaration":
      return [
        declarationRecord(
          declaration.id.name,
          "interface",
          true,
          declaration.start,
          declaration,
        ),
      ];
    case "TSTypeAliasDeclaration":
      return [
        declarationRecord(
          declaration.id.name,
          "type",
          true,
          declaration.start,
          declaration,
        ),
      ];
    case "TSEnumDeclaration":
      return [
        declarationRecord(
          declaration.id.name,
          "enum",
          false,
          declaration.start,
          declaration,
        ),
      ];
    default:
      return [];
  }
}

export function collectImportedBindings(
  program: Program,
): ReadonlyMap<string, ImportedBinding> {
  const bindings = new Map<string, ImportedBinding>();

  for (const statement of program.body) {
    if (statement.type === "ImportDeclaration") {
      addImportBindings(bindings, statement);
    } else if (statement.type === "TSImportEqualsDeclaration") {
      addImportEqualsBinding(bindings, statement);
    }
  }

  return bindings;
}

function topLevelDeclaration(
  statement: Program["body"][number],
): Declaration | undefined {
  switch (statement.type) {
    case "VariableDeclaration":
    case "FunctionDeclaration":
    case "TSDeclareFunction":
    case "ClassDeclaration":
    case "TSTypeAliasDeclaration":
    case "TSInterfaceDeclaration":
    case "TSEnumDeclaration":
    case "TSModuleDeclaration":
    case "TSImportEqualsDeclaration":
      return statement;
    default:
      return undefined;
  }
}

function variableDeclarationRecords(
  declaration: VariableDeclaration,
): LocalDeclarationRecord[] {
  return declaration.declarations.flatMap((declarator) =>
    bindingNames(declarator.id).map((name) =>
      declarationRecord(name, "variable", false, declarator.start, {
        declarationKind: declaration.kind,
        declare: declaration.declare,
        declarator,
      }),
    ),
  );
}

function declarationRecord(
  name: string,
  kind: ExportedSymbolKind,
  isTypeOnly: boolean,
  position: number,
  structure: Declaration | Readonly<Record<string, unknown>>,
): LocalDeclarationRecord {
  return {
    name,
    kind,
    isTypeOnly,
    position,
    structure,
  };
}

function bindingNames(
  pattern: BindingPattern | BindingRestElement,
): string[] {
  switch (pattern.type) {
    case "Identifier":
      return [pattern.name];
    case "AssignmentPattern":
      return bindingNames(pattern.left);
    case "RestElement":
      return bindingNames(pattern.argument);
    case "ObjectPattern":
      return pattern.properties.flatMap((property) =>
        property.type === "RestElement"
          ? bindingNames(property.argument)
          : bindingNames(property.value),
      );
    case "ArrayPattern":
      return pattern.elements.flatMap((element) =>
        element ? bindingNames(element) : [],
      );
  }
}

function addImportBindings(
  bindings: Map<string, ImportedBinding>,
  declaration: ImportDeclaration,
): void {
  for (const specifier of declaration.specifiers) {
    const baseBinding = {
      source: declaration.source.value,
      isTypeOnly: declaration.importKind === "type",
      structure: {
        attributes: declaration.attributes,
        phase: declaration.phase,
      },
    };

    switch (specifier.type) {
      case "ImportSpecifier":
        bindings.set(specifier.local.name, {
          ...baseBinding,
          importedName:
            specifier.imported.type === "Identifier"
              ? specifier.imported.name
              : specifier.imported.value,
          isTypeOnly:
            baseBinding.isTypeOnly || specifier.importKind === "type",
        });
        break;
      case "ImportDefaultSpecifier":
        bindings.set(specifier.local.name, {
          ...baseBinding,
          importedName: "default",
        });
        break;
      case "ImportNamespaceSpecifier":
        bindings.set(specifier.local.name, {
          ...baseBinding,
          importedName: "*",
        });
        break;
    }
  }
}

function addImportEqualsBinding(
  bindings: Map<string, ImportedBinding>,
  declaration: TSImportEqualsDeclaration,
): void {
  if (declaration.moduleReference.type !== "TSExternalModuleReference") return;

  bindings.set(declaration.id.name, {
    importedName: "*",
    source: declaration.moduleReference.expression.value,
    isTypeOnly: declaration.importKind === "type",
    structure: {
      importKind: declaration.importKind,
    },
  });
}
