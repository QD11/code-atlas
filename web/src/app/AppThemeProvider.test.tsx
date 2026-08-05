import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AppThemeProvider, useColorMode } from "./AppThemeProvider";

describe("AppThemeProvider", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("starts with the operating system color mode", () => {
    stubWindow({ systemDark: false });

    const markup = renderMode();

    expect(markup).toContain('data-mode="light"');
  });
});

function ModeProbe() {
  const { mode } = useColorMode();
  return <span data-mode={mode}>{mode}</span>;
}

function renderMode(): string {
  return renderToStaticMarkup(
    <AppThemeProvider>
      <ModeProbe />
    </AppThemeProvider>,
  );
}

function stubWindow({ systemDark }: { systemDark: boolean }): void {
  vi.stubGlobal("window", {
    matchMedia: () => ({
      addEventListener: vi.fn(),
      matches: systemDark,
      removeEventListener: vi.fn(),
    }),
  });
}
