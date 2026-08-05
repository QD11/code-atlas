import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ThemeProvider } from "styled-components";
import { describe, expect, it } from "vitest";
import { darkTheme } from "~/app/theme";
import { Graph } from "./Graph";

describe("Graph", () => {
  it("renders a reusable labeled graph boundary", () => {
    const markup = renderToStaticMarkup(
      <ThemeProvider theme={darkTheme}>
        <Graph
          edges={[{ source: "a", target: "b" }]}
          id="example-graph"
          label="Example dependency graph"
          nodes={[{ id: "a" }, { id: "b" }]}
        />
      </ThemeProvider>,
    );

    expect(markup).toContain('role="region"');
    expect(markup).toContain('id="example-graph"');
    expect(markup).toContain('aria-label="Example dependency graph"');
    expect(markup).toContain('aria-busy="true"');
    expect(markup).toContain("Rendering graph");
  });

  it("reports an empty graph without starting in a busy state", () => {
    const markup = renderToStaticMarkup(
      <ThemeProvider theme={darkTheme}>
        <Graph edges={[]} id="empty-graph" nodes={[]} />
      </ThemeProvider>,
    );

    expect(markup).toContain('aria-busy="false"');
    expect(markup).toContain("No graph data");
  });
});
