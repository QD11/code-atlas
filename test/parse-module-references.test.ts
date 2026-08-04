import { describe, expect, it } from "vitest";
import { parseModuleReferences } from "~/analyzer/parse-module-references.js";

describe("parseModuleReferences", () => {
  it("extracts static imports and their bindings", () => {
    const result = parseModuleReferences(
      "example.ts",
      `
        import primary, {
          value,
          source as local,
          type Shape,
        } from "./dependency.js";
        import type * as Models from "./models.js";
        import "./setup.js";
      `,
    );

    expect(result).toEqual({
      references: [
        {
          kind: "import",
          specifier: "./dependency.js",
          bindings: [
            {
              kind: "default",
              importedName: "default",
              localName: "primary",
              isTypeOnly: false,
            },
            {
              kind: "named",
              importedName: "value",
              localName: "value",
              isTypeOnly: false,
            },
            {
              kind: "named",
              importedName: "source",
              localName: "local",
              isTypeOnly: false,
            },
            {
              kind: "named",
              importedName: "Shape",
              localName: "Shape",
              isTypeOnly: true,
            },
          ],
        },
        {
          kind: "import",
          specifier: "./models.js",
          bindings: [
            {
              kind: "namespace",
              importedName: "*",
              localName: "Models",
              isTypeOnly: true,
            },
          ],
        },
        {
          kind: "import",
          specifier: "./setup.js",
          bindings: [],
        },
      ],
      diagnostics: [],
    });
  });

  it("extracts named, namespace, and star re-exports", () => {
    const result = parseModuleReferences(
      "example.ts",
      `
        export {
          default as Widget,
          source as renamed,
          type Model,
        } from "./dependency.js";
        export * from "./everything.js";
        export type * from "./types.js";
        export * as utilities from "./utilities.js";
        export type * as Models from "./models.js";

        const local = true;
        export { local };
        export default local;
      `,
    );

    expect(result).toEqual({
      references: [
        {
          kind: "re-export",
          specifier: "./dependency.js",
          bindings: [
            {
              kind: "named",
              importedName: "default",
              exportedName: "Widget",
              isTypeOnly: false,
            },
            {
              kind: "named",
              importedName: "source",
              exportedName: "renamed",
              isTypeOnly: false,
            },
            {
              kind: "named",
              importedName: "Model",
              exportedName: "Model",
              isTypeOnly: true,
            },
          ],
        },
        {
          kind: "re-export",
          specifier: "./everything.js",
          bindings: [
            {
              kind: "star",
              importedName: "*",
              exportedName: "*",
              isTypeOnly: false,
            },
          ],
        },
        {
          kind: "re-export",
          specifier: "./types.js",
          bindings: [
            {
              kind: "star",
              importedName: "*",
              exportedName: "*",
              isTypeOnly: true,
            },
          ],
        },
        {
          kind: "re-export",
          specifier: "./utilities.js",
          bindings: [
            {
              kind: "namespace",
              importedName: "*",
              exportedName: "utilities",
              isTypeOnly: false,
            },
          ],
        },
        {
          kind: "re-export",
          specifier: "./models.js",
          bindings: [
            {
              kind: "namespace",
              importedName: "*",
              exportedName: "Models",
              isTypeOnly: true,
            },
          ],
        },
      ],
      diagnostics: [],
    });
  });

  it("keeps source order when imports and re-exports are interleaved", () => {
    const result = parseModuleReferences(
      "example.ts",
      `
        export * from "./first.js";
        import { second } from "./second.js";
        export { third } from "./third.js";
      `,
    );

    expect(result.references.map((reference) => reference.specifier)).toEqual([
      "./first.js",
      "./second.js",
      "./third.js",
    ]);
  });

  it("reports syntax errors while preserving references it understood", () => {
    const result = parseModuleReferences(
      "broken.ts",
      `
        import { valid } from "./valid.js";
        export { broken from "./broken.js";
      `,
    );

    expect(result.references).toContainEqual({
      kind: "import",
      specifier: "./valid.js",
      bindings: [
        {
          kind: "named",
          importedName: "valid",
          localName: "valid",
          isTypeOnly: false,
        },
      ],
    });
    expect(result.diagnostics.length).toBeGreaterThan(0);
    expect(result.diagnostics[0]?.severity).toBe("error");
  });

  it("leaves CommonJS and dynamic imports for their own parser task", () => {
    const result = parseModuleReferences(
      "example.ts",
      `
        const commonJs = require("./common-js.js");
        const lazy = import("./lazy.js");
      `,
    );

    expect(result).toEqual({
      references: [],
      diagnostics: [],
    });
  });
});
