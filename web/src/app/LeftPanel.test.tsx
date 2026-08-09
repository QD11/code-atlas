import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ThemeProvider } from "styled-components";
import { describe, expect, it } from "vitest";
import type { ProjectSnapshotNode } from "@shared/project-snapshot.js";
import { buildFileTree, filterFiles, LeftPanel } from "./LeftPanel";
import { darkTheme } from "./theme";

describe("LeftPanel", () => {
  it("renders searchable project files and the current selection", () => {
    const markup = renderToStaticMarkup(
      <ThemeProvider theme={darkTheme}>
        <LeftPanel
          nodes={[node("index.ts"), node("src/zebra.ts"), node("src/app.ts")]}
          onFileSelect={() => undefined}
          selectedFileId="index.ts"
        />
      </ThemeProvider>,
    );

    expect(markup).toContain('aria-label="Project panel"');
    expect(markup).toContain("Project");
    expect(markup).toContain('type="search"');
    expect(markup).toContain('placeholder="Search files"');
    expect(markup).toContain("Files");
    expect(markup).toContain("src");
    expect(markup).toContain('aria-expanded="false"');
    expect(markup).toContain("index.ts");
    expect(markup).toContain('aria-current="true"');
  });

  it("groups files into sorted nested directories", () => {
    const tree = buildFileTree([
      node("web/components/Button.tsx"),
      node("src/zebra.ts"),
      node("index.ts"),
      node("src/app.ts"),
    ]);

    expect(tree.files.map(({ name }) => name)).toEqual(["index.ts"]);
    expect(tree.directories.map(({ name }) => name)).toEqual(["src", "web"]);
    expect(tree.directories[0]?.files.map(({ name }) => name)).toEqual([
      "app.ts",
      "zebra.ts",
    ]);
    expect(tree.directories[1]?.directories[0]?.path).toBe("web/components");
  });

  it("filters paths case-insensitively and sorts matching files", () => {
    expect(
      filterFiles(
        [node("src/Zebra.test.ts"), node("web/App.tsx"), node("src/app.ts")],
        " APP ",
      ).map(({ path }) => path),
    ).toEqual(["src/app.ts", "web/App.tsx"]);
  });
});

function node(id: string): ProjectSnapshotNode {
  return {
    id,
    path: id,
    name: id.split("/").at(-1) ?? id,
    extension: id.endsWith(".tsx") ? ".tsx" : ".ts",
    exists: true,
    changedExports: [],
    impactLevels: [],
    impactReasons: [],
  };
}
