import { describe, expect, it } from "vitest";
import { compareExportedSymbols } from "~/analyzer/compare-exported-symbols.js";
import { extractExportedSymbols } from "~/analyzer/extract-exported-symbols.js";

describe("compareExportedSymbols", () => {
  it("classifies added, modified, and removed public exports", () => {
    const head = exportsFrom(`
      export function changed() {
        return "before";
      }
      export const removed = true;
      export const unchanged = 42;
    `);
    const working = exportsFrom(`
      export function changed() {
        return "after";
      }
      export const unchanged = 42;
      export class Added {}
    `);

    expect(
      compareExportedSymbols(head, working).map(
        ({ name, status, before, after }) => ({
          name,
          status,
          beforeKind: before?.kind,
          afterKind: after?.kind,
        }),
      ),
    ).toEqual([
      {
        name: "Added",
        status: "added",
        beforeKind: undefined,
        afterKind: "class",
      },
      {
        name: "changed",
        status: "modified",
        beforeKind: "function",
        afterKind: "function",
      },
      {
        name: "removed",
        status: "removed",
        beforeKind: "variable",
        afterKind: undefined,
      },
    ]);
  });

  it("ignores comment-only and formatting-only edits", () => {
    const head = exportsFrom("export const value={answer:42};");
    const working = exportsFrom(`
      // This comment does not change the exported value.
      export const value = {
        answer: 42,
      };
    `);

    expect(compareExportedSymbols(head, working)).toEqual([]);
  });

  it("treats a re-export source change as a modification", () => {
    const head = exportsFrom('export { value } from "./first.js";');
    const working = exportsFrom('export { value } from "./second.js";');

    expect(compareExportedSymbols(head, working)).toMatchObject([
      {
        name: "value",
        status: "modified",
        before: { source: "./first.js" },
        after: { source: "./second.js" },
      },
    ]);
  });

  it("compares TypeScript type and value namespaces independently", () => {
    const head = exportsFrom(`
      export interface Shared {
        value: string;
      }
      export const Shared = "unchanged";
    `);
    const working = exportsFrom(`
      export interface Shared {
        value: number;
      }
      export const Shared = "unchanged";
    `);

    expect(
      compareExportedSymbols(head, working).map(
        ({ name, status, before, after }) => ({
          name,
          status,
          beforeTypeOnly: before?.isTypeOnly,
          afterTypeOnly: after?.isTypeOnly,
        }),
      ),
    ).toEqual([
      {
        name: "Shared",
        status: "modified",
        beforeTypeOnly: true,
        afterTypeOnly: true,
      },
    ]);
  });
});

function exportsFrom(sourceText: string) {
  return extractExportedSymbols("src/file.ts", sourceText).exports;
}
