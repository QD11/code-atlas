import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ThemeProvider } from "styled-components";
import { describe, expect, it } from "vitest";
import { LeftPanel } from "./LeftPanel";
import { darkTheme } from "./theme";

describe("LeftPanel", () => {
  it("renders the page-specific project panel", () => {
    const markup = renderToStaticMarkup(
      <ThemeProvider theme={darkTheme}>
        <LeftPanel />
      </ThemeProvider>,
    );

    expect(markup).toContain('aria-label="Project panel"');
    expect(markup).toContain("Project");
    expect(markup).toContain("Files and search will live here.");
  });
});
