import type {
  ExportDefaultDeclaration,
  Expression,
} from "oxc-parser";
import type { ExportedSymbolKind } from "~/shared/exported-symbol.js";

export function defaultDeclarationKind(
  declaration: ExportDefaultDeclaration["declaration"],
): ExportedSymbolKind {
  switch (declaration.type) {
    case "FunctionDeclaration":
    case "FunctionExpression":
      return "function";
    case "ClassDeclaration":
    case "ClassExpression":
      return "class";
    case "TSInterfaceDeclaration":
      return "interface";
    default:
      return defaultExpressionKind(declaration);
  }
}

export function defaultExpressionKind(
  expression: Expression,
): ExportedSymbolKind {
  switch (expression.type) {
    case "ArrowFunctionExpression":
    case "FunctionExpression":
      return "function";
    case "ClassExpression":
      return "class";
    default:
      return "default";
  }
}
