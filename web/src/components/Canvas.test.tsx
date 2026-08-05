import React from "react";
import type { ProjectSnapshotNode } from "@shared/project-snapshot.js";
import { renderToStaticMarkup } from "react-dom/server";
import { ThemeProvider } from "styled-components";
import { describe, expect, it } from "vitest";
import { darkTheme } from "~/app/theme";
import { Canvas } from "./Canvas";

describe("Canvas", () => {
  it("shows an accessible loading indicator while requesting data", () => {
    const markup = renderToStaticMarkup(
      <ThemeProvider theme={darkTheme}>
        <Canvas connection="connecting" edges={[]} nodes={[]} />
      </ThemeProvider>,
    );

    expect(markup).toContain('aria-label="Project graph canvas"');
    expect(markup).toContain('role="status"');
    expect(markup).toContain('aria-busy="true"');
    expect(markup).toContain('aria-hidden="true"');
    expect(markup).toContain("Loading project data");
  });

  it("passes snapshot relationships into the reusable graph", () => {
    const markup = renderToStaticMarkup(
      <ThemeProvider theme={darkTheme}>
        <Canvas connection="live" edges={[]} nodes={[node("src/app.ts")]} />
      </ThemeProvider>,
    );

    expect(markup).toContain(
      'aria-label="Project dependency graph with 1 file and 0 imports"',
    );
    expect(markup).toContain('id="project-dependency-graph"');
    expect(markup).toContain("Rendering graph");
    expect(markup).toContain("Fit view");
  });
});

function node(id: string): ProjectSnapshotNode {
  return {
    id,
    path: id,
    name: id.split("/").at(-1) ?? id,
    extension: ".ts",
    exists: true,
    changedExports: [],
    impactLevels: [],
    impactReasons: [],
  };
}
