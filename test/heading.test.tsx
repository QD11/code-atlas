import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Heading } from "../web/src/components/ui/Heading";

describe("Heading", () => {
  it("uses h1 when it is not inside a section", () => {
    const markup = renderToStaticMarkup(<Heading>Page title</Heading>);

    expect(markup).toMatch(/^<h1\b/);
    expect(markup).toContain("Page title</h1>");
  });

  it("forwards native heading attributes", () => {
    const markup = renderToStaticMarkup(
      <Heading data-testid="title" id="page-title">
        Page title
      </Heading>,
    );

    expect(markup).toContain('data-testid="title"');
    expect(markup).toContain('id="page-title"');
  });
});
