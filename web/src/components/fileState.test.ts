import { describe, expect, it } from "vitest";
import { darkTheme, lightTheme } from "~/app/theme";
import { FILE_STATE_LEGEND, fileState, fileStateGraphColor } from "./fileState";
import { graphColorFromHex, type GraphColor } from "./graphData";

describe("fileState", () => {
  it("prioritizes changes, then direct and transitive impact", () => {
    expect(
      fileState({
        changeStatus: "modified",
        impactLevels: ["transitive-impact"],
      }),
    ).toBe("changed");
    expect(
      fileState({
        impactLevels: ["transitive-impact", "direct-impact"],
      }),
    ).toBe("directImpact");
    expect(fileState({ impactLevels: ["transitive-impact"] })).toBe(
      "transitiveImpact",
    );
    expect(fileState({ impactLevels: [] })).toBe("unchanged");
  });

  it("converts theme colors to Cosmos RGBA values", () => {
    expect(fileStateGraphColor("changed", darkTheme.colors.fileState)).toEqual([
      1,
      126 / 255,
      182 / 255,
      1,
    ]);
    expect(
      fileStateGraphColor("unchanged", lightTheme.colors.fileState),
    ).toEqual([83 / 255, 109 / 255, 229 / 255, 1]);
    expect(
      fileStateGraphColor("directImpact", darkTheme.colors.fileState),
    ).toEqual([241 / 255, 194 / 255, 27 / 255, 1]);
    expect(
      fileStateGraphColor("transitiveImpact", lightTheme.colors.fileState),
    ).toEqual([0, 83 / 255, 154 / 255, 1]);
  });

  it("keeps every state visible against both graph canvases", () => {
    for (const theme of [darkTheme, lightTheme]) {
      const canvasColor = graphColorFromHex(theme.colors.canvas);
      for (const { state } of FILE_STATE_LEGEND) {
        const nodeColor = fileStateGraphColor(state, theme.colors.fileState);
        expect(
          contrastRatio(composite(nodeColor, canvasColor), canvasColor),
        ).toBeGreaterThanOrEqual(3);
      }
    }
  });

  it("gives every file state a distinct color in both themes", () => {
    for (const theme of [darkTheme, lightTheme]) {
      const stateColors = FILE_STATE_LEGEND.map(
        ({ state }) => theme.colors.fileState[state],
      );

      expect(new Set(stateColors).size).toBe(FILE_STATE_LEGEND.length);
    }
  });
});

function composite(foreground: GraphColor, background: GraphColor): GraphColor {
  const alpha = foreground[3];
  return [
    foreground[0] * alpha + background[0] * (1 - alpha),
    foreground[1] * alpha + background[1] * (1 - alpha),
    foreground[2] * alpha + background[2] * (1 - alpha),
    1,
  ];
}

function contrastRatio(first: GraphColor, second: GraphColor): number {
  const firstLuminance = relativeLuminance(first);
  const secondLuminance = relativeLuminance(second);

  return (
    (Math.max(firstLuminance, secondLuminance) + 0.05) /
    (Math.min(firstLuminance, secondLuminance) + 0.05)
  );
}

function relativeLuminance(color: GraphColor): number {
  const red = linearChannel(color[0]);
  const green = linearChannel(color[1]);
  const blue = linearChannel(color[2]);

  return red * 0.2126 + green * 0.7152 + blue * 0.0722;
}

function linearChannel(value: number): number {
  return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
}
