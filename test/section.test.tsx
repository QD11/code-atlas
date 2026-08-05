import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Heading, Section } from "../web/src/components/ui";

describe("Section", () => {
  it("increments heading levels as sections are nested", () => {
    const markup = renderToStaticMarkup(
      <Section>
        <Heading>Project</Heading>
        <Section>
          <Heading>Files</Heading>
          <Section>
            <Heading>Changed exports</Heading>
          </Section>
        </Section>
      </Section>,
    );

    expect(markup).toContain("<h1");
    expect(markup).toContain("Project</h1>");
    expect(markup).toContain("<h2");
    expect(markup).toContain("Files</h2>");
    expect(markup).toContain("<h3");
    expect(markup).toContain("Changed exports</h3>");
  });

  it("caps deeply nested headings at h6", () => {
    const markup = renderToStaticMarkup(
      <Section>
        <Section>
          <Section>
            <Section>
              <Section>
                <Section>
                  <Section>
                    <Heading>Deep section</Heading>
                  </Section>
                </Section>
              </Section>
            </Section>
          </Section>
        </Section>
      </Section>,
    );

    expect(markup).toContain("<h6");
    expect(markup).toContain("Deep section</h6>");
    expect(markup).not.toContain("<h7");
  });

  it("forwards native section attributes", () => {
    const markup = renderToStaticMarkup(
      <Section aria-label="Overview" id="overview">
        <Heading>Overview</Heading>
      </Section>,
    );

    expect(markup).toContain('aria-label="Overview"');
    expect(markup).toContain('id="overview"');
  });
});
