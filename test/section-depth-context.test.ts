import { describe, expect, it } from "vitest";
import {
  headingLevelForDepth,
  nextSectionDepth,
} from "../web/src/components/ui/section-depth-context.js";

describe("section depth helpers", () => {
  it("increments section depth and caps it at six", () => {
    expect(nextSectionDepth(0)).toBe(1);
    expect(nextSectionDepth(5)).toBe(6);
    expect(nextSectionDepth(6)).toBe(6);
  });

  it("maps depth to a valid heading level", () => {
    expect(headingLevelForDepth(0)).toBe(1);
    expect(headingLevelForDepth(3)).toBe(3);
    expect(headingLevelForDepth(7)).toBe(6);
  });
});
