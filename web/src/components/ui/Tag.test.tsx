import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ThemeProvider } from "styled-components";
import { describe, expect, it } from "vitest";
import { darkTheme } from "~/app/theme";
import { Tag } from "./Tag";

describe("Tag", () => {
  it("renders a reusable label and forwards native attributes", () => {
    const markup = renderToStaticMarkup(
      <ThemeProvider theme={darkTheme}>
        <Tag data-status="modified">Modified</Tag>
      </ThemeProvider>,
    );

    expect(markup).toContain("Modified");
    expect(markup).toContain('data-status="modified"');
  });
});
