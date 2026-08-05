import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ThemeProvider } from "styled-components";
import { describe, expect, it } from "vitest";
import { RightPanel } from "./RightPanel";
import { darkTheme } from "./theme";

describe("RightPanel", () => {
  it("renders the page-specific details panel", () => {
    const markup = renderToStaticMarkup(
      <ThemeProvider theme={darkTheme}>
        <RightPanel />
      </ThemeProvider>,
    );

    expect(markup).toContain('aria-label="Details panel"');
    expect(markup).toContain("Details");
    expect(markup).toContain(
      "Selected file information will live here.",
    );
  });
});
