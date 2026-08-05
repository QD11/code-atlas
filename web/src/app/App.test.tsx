import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { App } from "./App";
import { AppThemeProvider } from "./AppThemeProvider";

describe("App", () => {
  it("renders the connected workspace while analysis is loading", () => {
    const markup = renderToStaticMarkup(
      <AppThemeProvider>
        <App />
      </AppThemeProvider>,
    );

    expect(markup).toContain("Code Atlas");
    expect(markup).toContain("Connecting to local analyzer");
    expect(markup).toContain("Loading project data");
    expect(markup).toContain('aria-label="Use light mode"');
    expect(markup).toContain('aria-label="Project panel"');
    expect(markup).toContain('aria-label="Details panel"');
  });
});
