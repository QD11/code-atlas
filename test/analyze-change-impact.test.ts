import { describe, expect, it } from "vitest";
import { analyzeChangeImpact } from "~/analyzer/analyze-change-impact.js";
import type {
  AnalyzeExportChangesResult,
  ChangedFileExportAnalysis,
  ExportedSymbolChangeStatus,
} from "~/shared/exported-symbol-change.js";
import type { ExportedSymbol } from "~/shared/exported-symbol.js";
import type {
  ImportBinding,
  ModuleReference,
  ReExportBinding,
} from "~/shared/module-reference.js";
import type {
  ProjectGraph,
  ProjectGraphEdge,
} from "~/shared/project-graph.js";

describe("analyzeChangeImpact", () => {
  it("highlights only importers of the exact changed export", () => {
    const graph = projectGraph([
      importEdge("add-page", "math", [
        namedImport("add"),
      ]),
      importEdge("subtract-page", "math", [
        namedImport("subtract"),
      ]),
      importEdge("namespace-page", "math", [
        namespaceImport(),
      ]),
      edge("side-effect", "math", {
        kind: "import",
        specifier: "./math.js",
        certainty: "confirmed",
        bindings: [],
      }),
    ]);

    const result = analyzeChangeImpact(
      graph,
      exportResult([changedFile("math", "add")]),
      { includeTransitive: false },
    );

    expect(
      result.files.map(({ fileId, levels }) => ({ fileId, levels })),
    ).toEqual([
      { fileId: "add-page", levels: ["direct-impact"] },
      { fileId: "math", levels: ["direct-change"] },
      { fileId: "namespace-page", levels: ["direct-impact"] },
    ]);
    expect(result.edges.map(({ edgeId }) => edgeId)).toEqual([
      "add-page->math",
      "namespace-page->math",
    ]);
  });

  it("marks downstream consumers and their edges as inferred transitive impact", () => {
    const graph = projectGraph([
      importEdge("direct", "changed", [namedImport("value")]),
      importEdge("downstream", "direct", [namedImport("render")]),
      importEdge("root", "downstream", [defaultImport()]),
    ]);

    const result = analyzeChangeImpact(
      graph,
      exportResult([changedFile("changed", "value")]),
    );

    expect(
      result.files.map(({ fileId, levels }) => ({ fileId, levels })),
    ).toEqual([
      { fileId: "changed", levels: ["direct-change"] },
      { fileId: "direct", levels: ["direct-impact"] },
      { fileId: "downstream", levels: ["transitive-impact"] },
      { fileId: "root", levels: ["transitive-impact"] },
    ]);
    expect(
      result.files
        .find(({ fileId }) => fileId === "root")
        ?.reasons[0],
    ).toMatchObject({
      level: "transitive-impact",
      viaFile: "downstream",
      distance: 3,
      certainty: "inferred",
    });
    expect(result.edges).toMatchObject([
      {
        edgeId: "direct->changed",
        directChanges: [{ name: "value" }],
        transitiveOrigins: [],
      },
      {
        edgeId: "downstream->direct",
        directChanges: [],
        transitiveOrigins: [{ name: "value" }],
      },
      {
        edgeId: "root->downstream",
        directChanges: [],
        transitiveOrigins: [{ name: "value" }],
      },
    ]);
  });

  it("handles dynamic imports, inferred require calls, and re-exports", () => {
    const graph = projectGraph([
      edge("lazy", "changed", {
        kind: "dynamic-import",
        specifier: "./changed.js",
        certainty: "confirmed",
        bindings: [],
      }),
      edge("legacy", "changed", {
        kind: "require",
        specifier: "./changed.js",
        certainty: "inferred",
        bindings: [],
      }),
      reExportEdge("barrel", "changed", [
        {
          kind: "named",
          importedName: "value",
          exportedName: "publicValue",
          isTypeOnly: false,
        },
      ]),
    ]);

    const result = analyzeChangeImpact(
      graph,
      exportResult([changedFile("changed", "value")]),
      { includeTransitive: false },
    );

    expect(
      result.files
        .filter(({ fileId }) => fileId !== "changed")
        .map(({ fileId, reasons }) => ({
          fileId,
          certainty: reasons[0]?.certainty,
        })),
    ).toEqual([
      { fileId: "barrel", certainty: "confirmed" },
      { fileId: "lazy", certainty: "confirmed" },
      { fileId: "legacy", certainty: "inferred" },
    ]);
  });

  it("does not treat a default export as carried by export star", () => {
    const graph = projectGraph([
      reExportEdge("star-barrel", "changed", [
        {
          kind: "star",
          importedName: "*",
          exportedName: "*",
          isTypeOnly: false,
        },
      ]),
      reExportEdge("namespace-barrel", "changed", [
        {
          kind: "namespace",
          importedName: "*",
          exportedName: "changed",
          isTypeOnly: false,
        },
      ]),
    ]);

    const result = analyzeChangeImpact(
      graph,
      exportResult([
        changedFile("changed", "default", "removed", {
          isDefault: true,
        }),
      ]),
      { includeTransitive: false },
    );

    expect(result.files.map(({ fileId }) => fileId)).toEqual([
      "changed",
      "namespace-barrel",
    ]);
  });

  it("matches import edges that still target a renamed file's old path", () => {
    const graph = projectGraph([
      importEdge("consumer", "old-name", [namedImport("value")]),
    ]);
    const renamed = changedFile("new-name", "value");
    renamed.fileChange = {
      status: "renamed",
      path: "new-name",
      previousPath: "old-name",
    };

    const result = analyzeChangeImpact(
      graph,
      exportResult([renamed]),
      { includeTransitive: false },
    );

    expect(result.files.map(({ fileId, levels }) => ({ fileId, levels }))).toEqual([
      { fileId: "consumer", levels: ["direct-impact"] },
      { fileId: "new-name", levels: ["direct-change"] },
    ]);
  });

  it("allows a changed file to also be directly impacted by another change", () => {
    const graph = projectGraph([
      importEdge("changed-a", "changed-b", [namedImport("second")]),
    ]);

    const result = analyzeChangeImpact(
      graph,
      exportResult([
        changedFile("changed-a", "first"),
        changedFile("changed-b", "second"),
      ]),
      { includeTransitive: false },
    );

    expect(
      result.files.find(({ fileId }) => fileId === "changed-a")?.levels,
    ).toEqual(["direct-change", "direct-impact"]);
  });

  it("terminates transitive traversal across dependency cycles", () => {
    const graph = projectGraph([
      importEdge("direct", "changed", [namedImport("value")]),
      importEdge("cycle-a", "direct", [namedImport("value")]),
      importEdge("cycle-b", "cycle-a", [namedImport("value")]),
      importEdge("cycle-a", "cycle-b", [namedImport("value")]),
    ]);

    const result = analyzeChangeImpact(
      graph,
      exportResult([changedFile("changed", "value")]),
    );

    expect(result.files.map(({ fileId }) => fileId)).toEqual([
      "changed",
      "cycle-a",
      "cycle-b",
      "direct",
    ]);
  });
});

function changedFile(
  path: string,
  name: string,
  status: ExportedSymbolChangeStatus = "modified",
  symbolOverrides: Partial<ExportedSymbol> = {},
): ChangedFileExportAnalysis {
  const before = symbol(name, "before", symbolOverrides);
  const after = symbol(name, "after", symbolOverrides);

  return {
    fileChange: { status: "modified", path },
    headExports: status === "added" ? [] : [before],
    workingExports: status === "removed" ? [] : [after],
    exportedSymbolChanges: [
      {
        name,
        status,
        ...(status === "added" ? {} : { before }),
        ...(status === "removed" ? {} : { after }),
      },
    ],
  };
}

function symbol(
  name: string,
  fingerprint: string,
  overrides: Partial<ExportedSymbol>,
): ExportedSymbol {
  return {
    name,
    kind: name === "default" ? "default" : "variable",
    origin: name === "default" ? "default" : "declaration",
    isDefault: name === "default",
    isTypeOnly: false,
    certainty: "confirmed",
    fingerprint,
    ...overrides,
  };
}

function exportResult(
  files: ChangedFileExportAnalysis[],
): AnalyzeExportChangesResult {
  return {
    git: {
      projectRoot: "/project",
      repositoryRoot: "/project",
      headCommit: "head",
      changes: files.map(({ fileChange }) => fileChange),
      diagnostics: [],
    },
    files,
    diagnostics: [],
  };
}

function projectGraph(edges: ProjectGraphEdge[]): ProjectGraph {
  const fileIds = new Set(
    edges.flatMap(({ source, target }) => [source, target]),
  );
  return {
    nodes: [...fileIds].toSorted().map((fileId) => ({
      id: fileId,
      path: fileId,
      name: fileId,
      extension: ".ts",
    })),
    edges: edges.toSorted((left, right) =>
      left.id.localeCompare(right.id),
    ),
  };
}

function importEdge(
  source: string,
  target: string,
  bindings: ImportBinding[],
): ProjectGraphEdge {
  return edge(source, target, {
    kind: "import",
    specifier: `./${target}.js`,
    certainty: "confirmed",
    bindings,
  });
}

function reExportEdge(
  source: string,
  target: string,
  bindings: ReExportBinding[],
): ProjectGraphEdge {
  return edge(source, target, {
    kind: "re-export",
    specifier: `./${target}.js`,
    certainty: "confirmed",
    bindings,
  });
}

function edge(
  source: string,
  target: string,
  reference: ModuleReference,
): ProjectGraphEdge {
  return {
    id: `${source}->${target}`,
    source,
    target,
    certainty: reference.certainty,
    references: [reference],
  };
}

function namedImport(importedName: string): ImportBinding {
  return {
    kind: "named",
    importedName,
    localName: importedName,
    isTypeOnly: false,
  };
}

function defaultImport(): ImportBinding {
  return {
    kind: "default",
    importedName: "default",
    localName: "defaultExport",
    isTypeOnly: false,
  };
}

function namespaceImport(): ImportBinding {
  return {
    kind: "namespace",
    importedName: "*",
    localName: "module",
    isTypeOnly: false,
  };
}
