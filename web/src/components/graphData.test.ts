import { describe, expect, it } from "vitest";
import {
  buildCosmosGraphData,
  buildPointColors,
  buildSelectedLinkAppearance,
  findConnectedLinkIndices,
  findConnectedPointIndices,
  GraphLinkStyle,
  graphColorFromHex,
} from "./graphData";

describe("buildCosmosGraphData", () => {
  it("maps stable node identifiers to Cosmos point and link arrays", () => {
    const result = buildCosmosGraphData(
      [{ id: "a", color: [1, 0, 0, 1], size: 9 }, { id: "b" }, { id: "c" }],
      [
        {
          source: "a",
          target: "b",
          color: [0, 0, 1, 1],
          directed: false,
          width: 2,
        },
        { source: "c", target: "missing" },
      ],
    );

    expect(result.nodeIndices).toEqual(
      new Map([
        ["a", 0],
        ["b", 1],
        ["c", 2],
      ]),
    );
    expect([...result.links]).toEqual([0, 1]);
    expect([...result.pointColors.slice(0, 4)]).toEqual([1, 0, 0, 1]);
    expect(result.pointSizes[0]).toBe(9);
    expect([...result.linkColors]).toEqual([0, 0, 1, 1]);
    expect([...result.linkWidths]).toEqual([2]);
    expect(result.linkArrows).toEqual([false]);
  });

  it("creates deterministic starting positions", () => {
    const nodes = [{ id: "a" }, { id: "b" }, { id: "c" }];

    const first = buildCosmosGraphData(nodes, []);
    const second = buildCosmosGraphData(nodes, []);

    expect([...first.pointPositions]).toEqual([...second.pointPositions]);
    expect([...first.pointPositions.slice(0, 2)]).toEqual([0, 0]);
  });

  it("shows arrows for relationships unless an edge opts out", () => {
    const result = buildCosmosGraphData(
      [{ id: "a" }, { id: "b" }, { id: "c" }],
      [
        { source: "a", target: "b" },
        { source: "b", target: "c", directed: false },
      ],
    );

    expect(result.linkArrows).toEqual([true, false]);
  });

  it("builds point-color updates independently from graph positions", () => {
    const colors = buildPointColors(3, [[1, 0, 0, 1], undefined, [0, 0, 1, 1]]);

    expect([...colors.slice(0, 4)]).toEqual([1, 0, 0, 1]);
    expect([...colors.slice(4, 8)].every(Number.isNaN)).toBe(true);
    expect([...colors.slice(8, 12)]).toEqual([0, 0, 1, 1]);
  });

  it("styles selected imports and importers without changing other links", () => {
    const data = buildCosmosGraphData(
      [
        { id: "selected" },
        { id: "import" },
        { id: "importer" },
        { id: "other" },
      ],
      [
        { source: "selected", target: "import" },
        { source: "importer", target: "selected" },
        { source: "importer", target: "other" },
      ],
    );
    const appearance = buildSelectedLinkAppearance(
      data,
      "selected",
      [0, 0, 1, 1],
    );

    expect([...appearance.linkColors.slice(0, 4)]).toEqual([0, 0, 1, 1]);
    expect([...appearance.linkColors.slice(4, 8)]).toEqual([0, 0, 1, 1]);
    expect([...appearance.linkColors.slice(8, 12)].every(Number.isNaN)).toBe(
      true,
    );
    expect(appearance.linkWidths[0]).toBe(3);
    expect(appearance.linkWidths[1]).toBe(3);
    expect(Number.isNaN(appearance.linkWidths[2])).toBe(true);
    expect(appearance.linkStyles[0]).toBe(GraphLinkStyle.Solid);
    expect(appearance.linkStyles[1]).toBe(GraphLinkStyle.Dashed);
    expect(Number.isNaN(appearance.linkStyles[2])).toBe(true);
  });

  it("converts hexadecimal colors to Cosmos RGBA values", () => {
    expect(graphColorFromHex("#78a9ff")).toEqual([120 / 255, 169 / 255, 1, 1]);
  });

  it("finds only links connected to a selected node", () => {
    const links = new Float32Array([0, 1, 2, 0, 1, 2]);

    expect(findConnectedLinkIndices(links, 0)).toEqual([0, 1]);
    expect(findConnectedLinkIndices(links, 1)).toEqual([0, 2]);
    expect(findConnectedLinkIndices(links, 3)).toEqual([]);
  });

  it("keeps the selected point and its directly connected points visible", () => {
    const links = new Float32Array([0, 1, 2, 0, 1, 2, 0, 1]);

    expect(findConnectedPointIndices(links, 0)).toEqual([0, 1, 2]);
    expect(findConnectedPointIndices(links, 3)).toEqual([3]);
  });
});
