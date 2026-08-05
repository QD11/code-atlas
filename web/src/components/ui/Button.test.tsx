import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Button } from "./Button";

describe("Button", () => {
  it("preserves native button semantics and attributes", () => {
    const markup = renderToStaticMarkup(
      <Button disabled type="button">
        Fit view
      </Button>,
    );

    expect(markup).toMatch(/^<button\b/);
    expect(markup).toContain('type="button"');
    expect(markup).toContain("disabled");
    expect(markup).toContain("Fit view</button>");
  });
});
