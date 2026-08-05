import React from "react";
import type {
  ProjectSnapshotEdge,
  ProjectSnapshotNode,
} from "@shared/project-snapshot.js";
import { renderToStaticMarkup } from "react-dom/server";
import { ThemeProvider } from "styled-components";
import { describe, expect, it } from "vitest";
import { RightPanel } from "./RightPanel";
import { darkTheme } from "./theme";

describe("RightPanel", () => {
  it("renders the page-specific details panel", () => {
    const markup = renderToStaticMarkup(
      <ThemeProvider theme={darkTheme}>
        <RightPanel
          edges={[]}
          isOpen
          nodes={[]}
          onOpenChange={() => undefined}
        />
      </ThemeProvider>,
    );

    expect(markup).toContain('aria-label="Details panel"');
    expect(markup).toContain('aria-label="Resize details panel"');
    expect(markup).toContain('role="separator"');
    expect(markup).toContain('aria-orientation="vertical"');
    expect(markup).toContain('aria-valuemin="240"');
    expect(markup).toContain('aria-valuemax="560"');
    expect(markup).toContain('aria-valuenow="300"');
    expect(markup).toContain('aria-label="Hide details panel"');
    expect(markup).toContain('aria-expanded="true"');
    expect(markup).toContain("Details");
    expect(markup).toContain(
      "Select a file in the graph to inspect its details.",
    );
  });

  it("shows the selected file and its direct relationships", () => {
    const selectedFile = node("src/app.ts", {
      changeStatus: "modified",
      changedExports: [{ name: "createApp", status: "modified" }],
    });
    const importedFile = node("src/theme.ts");
    const importingFile = node("src/main.ts");
    const nodes = [selectedFile, importedFile, importingFile];
    const edges = [
      edge("src/app.ts", "src/theme.ts", ["tokens"]),
      edge("src/main.ts", "src/app.ts", ["createApp"]),
    ];
    const markup = renderToStaticMarkup(
      <ThemeProvider theme={darkTheme}>
        <RightPanel
          edges={edges}
          isOpen
          nodes={nodes}
          onOpenChange={() => undefined}
          selectedFile={selectedFile}
        />
      </ThemeProvider>,
    );

    expect(markup).toContain("src/app.ts");
    expect(markup).toContain("Modified");
    expect(markup).toContain("createApp");
    expect(markup.match(/src\/theme\.ts/g)).toHaveLength(1);
    expect(markup.match(/src\/main\.ts/g)).toHaveLength(1);
    expect(markup).toContain("Imports: tokens");
    expect(markup).toContain("Imports: createApp");
    expect(markup).toContain("No change impact identified");
  });
});

function node(
  id: string,
  overrides: Partial<ProjectSnapshotNode> = {},
): ProjectSnapshotNode {
  return {
    id,
    path: id,
    name: id.split("/").at(-1) ?? id,
    extension: ".ts",
    exists: true,
    changedExports: [],
    impactLevels: [],
    impactReasons: [],
    ...overrides,
  };
}

function edge(
  source: string,
  target: string,
  importedNames: string[],
): ProjectSnapshotEdge {
  return {
    id: `${source}->${target}`,
    source,
    target,
    certainty: "confirmed",
    references: [
      {
        kind: "import",
        specifier: target,
        certainty: "confirmed",
        bindings: importedNames.map((importedName) => ({
          kind: "named",
          importedName,
          localName: importedName,
          isTypeOnly: false,
        })),
      },
    ],
    historical: false,
  };
}
