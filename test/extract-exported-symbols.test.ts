import { describe, expect, it } from "vitest";
import { extractExportedSymbols } from "~/analyzer/extract-exported-symbols.js";
import type { ExportedSymbol } from "~/shared/exported-symbol.js";

describe("extractExportedSymbols", () => {
  it("extracts exported JavaScript and TypeScript declarations", () => {
    const result = extractExportedSymbols(
      "example.ts",
      `
        export function calculate(value: number): number {
          return value * 2;
        }

        export class Service {
          run(): string {
            return "running";
          }
        }

        export const answer = 42, label = "atlas";
        export let mutable = true;
        export interface Options { enabled: boolean }
        export type Identifier = string | number;
        export enum Direction { Up, Down }
      `,
    );

    expect(withoutFingerprints(result.exports)).toEqual([
      {
        name: "calculate",
        kind: "function",
        origin: "declaration",
        localName: "calculate",
        isDefault: false,
        isTypeOnly: false,
        certainty: "confirmed",
      },
      {
        name: "Service",
        kind: "class",
        origin: "declaration",
        localName: "Service",
        isDefault: false,
        isTypeOnly: false,
        certainty: "confirmed",
      },
      {
        name: "answer",
        kind: "variable",
        origin: "declaration",
        localName: "answer",
        isDefault: false,
        isTypeOnly: false,
        certainty: "confirmed",
      },
      {
        name: "label",
        kind: "variable",
        origin: "declaration",
        localName: "label",
        isDefault: false,
        isTypeOnly: false,
        certainty: "confirmed",
      },
      {
        name: "mutable",
        kind: "variable",
        origin: "declaration",
        localName: "mutable",
        isDefault: false,
        isTypeOnly: false,
        certainty: "confirmed",
      },
      {
        name: "Options",
        kind: "interface",
        origin: "declaration",
        localName: "Options",
        isDefault: false,
        isTypeOnly: true,
        certainty: "confirmed",
      },
      {
        name: "Identifier",
        kind: "type",
        origin: "declaration",
        localName: "Identifier",
        isDefault: false,
        isTypeOnly: true,
        certainty: "confirmed",
      },
      {
        name: "Direction",
        kind: "enum",
        origin: "declaration",
        localName: "Direction",
        isDefault: false,
        isTypeOnly: false,
        certainty: "confirmed",
      },
    ]);
    expectValidFingerprints(result.exports);
    expect(result.diagnostics).toEqual([]);
  });

  it("extracts local export lists and destructured variable bindings", () => {
    const result = extractExportedSymbols(
      "example.ts",
      `
        const internal = 1;
        interface InternalShape { value: number }
        export { internal as publicValue };
        export type { InternalShape as PublicShape };
        export const { first, nested: renamed, ...rest } = source;
        export const [head, , ...tail] = values;
      `,
    );

    expect(
      withoutFingerprints(result.exports).map(
        ({ name, kind, origin, localName, isTypeOnly }) => ({
          name,
          kind,
          origin,
          localName,
          isTypeOnly,
        }),
      ),
    ).toEqual([
      {
        name: "publicValue",
        kind: "variable",
        origin: "local-export",
        localName: "internal",
        isTypeOnly: false,
      },
      {
        name: "PublicShape",
        kind: "interface",
        origin: "local-export",
        localName: "InternalShape",
        isTypeOnly: true,
      },
      {
        name: "first",
        kind: "variable",
        origin: "declaration",
        localName: "first",
        isTypeOnly: false,
      },
      {
        name: "renamed",
        kind: "variable",
        origin: "declaration",
        localName: "renamed",
        isTypeOnly: false,
      },
      {
        name: "rest",
        kind: "variable",
        origin: "declaration",
        localName: "rest",
        isTypeOnly: false,
      },
      {
        name: "head",
        kind: "variable",
        origin: "declaration",
        localName: "head",
        isTypeOnly: false,
      },
      {
        name: "tail",
        kind: "variable",
        origin: "declaration",
        localName: "tail",
        isTypeOnly: false,
      },
    ]);
    expect(result.diagnostics).toEqual([]);
  });

  it("extracts direct, imported, namespace, and star re-exports", () => {
    const result = extractExportedSymbols(
      "barrel.ts",
      `
        import { indirect, type ImportedType } from "./indirect.js";
        export { indirect as forwarded };
        export type { ImportedType };
        export { value as renamed, type Model } from "./dependency.js";
        export { default } from "./default.js";
        export * from "./everything.js";
        export type * from "./types.js";
        export * as utilities from "./utilities.js";
      `,
    );

    expect(withoutFingerprints(result.exports)).toEqual([
      {
        name: "forwarded",
        kind: "re-export",
        origin: "re-export",
        importedName: "indirect",
        source: "./indirect.js",
        isDefault: false,
        isTypeOnly: false,
        certainty: "confirmed",
      },
      {
        name: "ImportedType",
        kind: "re-export",
        origin: "re-export",
        importedName: "ImportedType",
        source: "./indirect.js",
        isDefault: false,
        isTypeOnly: true,
        certainty: "confirmed",
      },
      {
        name: "renamed",
        kind: "re-export",
        origin: "re-export",
        importedName: "value",
        source: "./dependency.js",
        isDefault: false,
        isTypeOnly: false,
        certainty: "confirmed",
      },
      {
        name: "Model",
        kind: "re-export",
        origin: "re-export",
        importedName: "Model",
        source: "./dependency.js",
        isDefault: false,
        isTypeOnly: true,
        certainty: "confirmed",
      },
      {
        name: "default",
        kind: "re-export",
        origin: "re-export",
        importedName: "default",
        source: "./default.js",
        isDefault: true,
        isTypeOnly: false,
        certainty: "confirmed",
      },
      {
        name: "*",
        kind: "star-re-export",
        origin: "re-export",
        importedName: "*",
        source: "./everything.js",
        isDefault: false,
        isTypeOnly: false,
        certainty: "confirmed",
      },
      {
        name: "*",
        kind: "star-re-export",
        origin: "re-export",
        importedName: "*",
        source: "./types.js",
        isDefault: false,
        isTypeOnly: true,
        certainty: "confirmed",
      },
      {
        name: "utilities",
        kind: "namespace-re-export",
        origin: "re-export",
        importedName: "*",
        source: "./utilities.js",
        isDefault: false,
        isTypeOnly: false,
        certainty: "confirmed",
      },
    ]);
    expect(result.diagnostics).toEqual([]);
  });

  it("extracts declaration, expression, and referenced default exports", () => {
    const functionResult = extractExportedSymbols(
      "function.ts",
      "export default function named(value: number) { return value; }",
    );
    const expressionResult = extractExportedSymbols(
      "expression.ts",
      "export default { enabled: true };",
    );
    const referencedResult = extractExportedSymbols(
      "referenced.ts",
      `
        const configuration = { enabled: true };
        export default configuration;
      `,
    );
    const assignmentResult = extractExportedSymbols(
      "assignment.ts",
      `
        function legacy() { return true; }
        export = legacy;
      `,
    );

    expect(withoutFingerprints(functionResult.exports)).toEqual([
      {
        name: "default",
        kind: "function",
        origin: "default",
        localName: "named",
        isDefault: true,
        isTypeOnly: false,
        certainty: "confirmed",
      },
    ]);
    expect(withoutFingerprints(expressionResult.exports)).toEqual([
      {
        name: "default",
        kind: "default",
        origin: "default",
        isDefault: true,
        isTypeOnly: false,
        certainty: "confirmed",
      },
    ]);
    expect(withoutFingerprints(referencedResult.exports)).toEqual([
      {
        name: "default",
        kind: "variable",
        origin: "default",
        localName: "configuration",
        isDefault: true,
        isTypeOnly: false,
        certainty: "confirmed",
      },
    ]);
    expect(withoutFingerprints(assignmentResult.exports)).toEqual([
      {
        name: "default",
        kind: "function",
        origin: "default",
        localName: "legacy",
        isDefault: true,
        isTypeOnly: false,
        certainty: "confirmed",
      },
    ]);
  });

  it("extracts inferred CommonJS exports", () => {
    const result = extractExportedSymbols(
      "legacy.cjs",
      `
        exports.calculate = function (value) { return value * 2; };
        module.exports.Service = class Service {};
        module["exports"]["enabled"] = true;
        module.exports = { calculate: exports.calculate };
        Object.defineProperty(exports, "__esModule", { value: true });
      `,
    );

    expect(withoutFingerprints(result.exports)).toEqual([
      {
        name: "calculate",
        kind: "function",
        origin: "commonjs",
        isDefault: false,
        isTypeOnly: false,
        certainty: "inferred",
      },
      {
        name: "Service",
        kind: "class",
        origin: "commonjs",
        isDefault: false,
        isTypeOnly: false,
        certainty: "inferred",
      },
      {
        name: "enabled",
        kind: "variable",
        origin: "commonjs",
        isDefault: false,
        isTypeOnly: false,
        certainty: "inferred",
      },
      {
        name: "default",
        kind: "default",
        origin: "commonjs",
        isDefault: true,
        isTypeOnly: false,
        certainty: "inferred",
      },
    ]);
    expect(result.diagnostics).toEqual([]);
  });

  it("extracts re-exported TypeScript import-equals bindings", () => {
    const result = extractExportedSymbols(
      "legacy.ts",
      `
        import legacy = require("./legacy.cjs");
        export { legacy as legacyNamespace };
      `,
    );

    expect(withoutFingerprints(result.exports)).toEqual([
      {
        name: "legacyNamespace",
        kind: "re-export",
        origin: "re-export",
        importedName: "*",
        source: "./legacy.cjs",
        isDefault: false,
        isTypeOnly: false,
        certainty: "confirmed",
      },
    ]);
    expect(result.diagnostics).toEqual([]);
  });

  it("warns about computed CommonJS export names", () => {
    const result = extractExportedSymbols(
      "dynamic.cjs",
      `
        exports[exportName] = 1;
        module.exports[otherName] = 2;
      `,
    );

    expect(result.exports).toEqual([]);
    expect(result.diagnostics).toEqual([
      {
        severity: "warning",
        message:
          "Computed CommonJS export name cannot be determined statically",
      },
      {
        severity: "warning",
        message:
          "Computed CommonJS export name cannot be determined statically",
      },
    ]);
  });

  it("includes referenced CommonJS declarations in fingerprints", () => {
    const before = extractExportedSymbols(
      "legacy.cjs",
      `
        function calculate(value) { return value * 2; }
        exports.calculate = calculate;
      `,
    );
    const changed = extractExportedSymbols(
      "legacy.cjs",
      `
        function calculate(value) { return value * 3; }
        exports.calculate = calculate;
      `,
    );

    expect(before.exports[0]).toMatchObject({
      name: "calculate",
      kind: "function",
      certainty: "inferred",
    });
    expect(changed.exports[0]?.fingerprint).not.toBe(
      before.exports[0]?.fingerprint,
    );
  });

  it("keeps fingerprints stable across comments and formatting", () => {
    const before = extractExportedSymbols(
      "example.ts",
      `
        // Original comment
        export function calculate(value: number) {
          return (value + 1_000);
        }

        export const first = 1, second = 2;
      `,
    );
    const formatted = extractExportedSymbols(
      "example.ts",
      `
        /* Completely different comment. */
        export function calculate(
          value: number,
        ) { return value + 1000 }

        export const first=1,second=2
      `,
    );
    const changed = extractExportedSymbols(
      "example.ts",
      `
        export function calculate(value: number) {
          return value + 1001;
        }

        export const first = 1, second = 3;
      `,
    );

    expect(fingerprintByName(formatted.exports)).toEqual(
      fingerprintByName(before.exports),
    );
    expect(fingerprintByName(changed.exports).calculate).not.toBe(
      fingerprintByName(before.exports).calculate,
    );
    expect(fingerprintByName(changed.exports).first).toBe(
      fingerprintByName(before.exports).first,
    );
    expect(fingerprintByName(changed.exports).second).not.toBe(
      fingerprintByName(before.exports).second,
    );
  });

  it("fingerprints grouped re-exports independently", () => {
    const before = extractExportedSymbols(
      "barrel.ts",
      'export { first, second } from "./dependency.js";',
    );
    const changed = extractExportedSymbols(
      "barrel.ts",
      'export { first, second as renamed } from "./dependency.js";',
    );

    expect(fingerprintByName(changed.exports).first).toBe(
      fingerprintByName(before.exports).first,
    );
    expect(changed.exports.map((symbol) => symbol.name)).toEqual([
      "first",
      "renamed",
    ]);
  });

  it("combines overload declarations into one exported symbol", () => {
    const result = extractExportedSymbols(
      "overloads.ts",
      `
        export function parse(value: string): string;
        export function parse(value: number): number;
        export function parse(value: string | number): string | number {
          return value;
        }
      `,
    );

    expect(result.exports).toHaveLength(1);
    expect(result.exports[0]).toMatchObject({
      name: "parse",
      kind: "function",
      origin: "declaration",
    });
  });

  it("reports unresolved local export declarations without dropping them", () => {
    const result = extractExportedSymbols(
      "invalid.ts",
      "export { missing as publicName };",
    );

    expect(withoutFingerprints(result.exports)).toEqual([
      {
        name: "publicName",
        kind: "unknown",
        origin: "local-export",
        localName: "missing",
        isDefault: false,
        isTypeOnly: false,
        certainty: "confirmed",
      },
    ]);
    expect(result.diagnostics).toContainEqual({
      severity: "warning",
      message: 'Could not find local declaration for exported symbol "missing"',
    });
  });
});

function withoutFingerprints(
  exports: readonly ExportedSymbol[],
): Omit<ExportedSymbol, "fingerprint">[] {
  return exports.map(({ fingerprint: _fingerprint, ...symbol }) => symbol);
}

function expectValidFingerprints(exports: readonly ExportedSymbol[]): void {
  for (const exportedSymbol of exports) {
    expect(exportedSymbol.fingerprint).toMatch(/^[0-9a-f]{64}$/);
  }
}

function fingerprintByName(
  exports: readonly ExportedSymbol[],
): Record<string, string> {
  return Object.fromEntries(
    exports.map((exportedSymbol) => [
      exportedSymbol.name,
      exportedSymbol.fingerprint,
    ]),
  );
}
