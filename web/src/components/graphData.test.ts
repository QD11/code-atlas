import { describe, expect, it } from "vitest";
import { buildCosmosGraphData, findConnectedLinkIndices } from "./graphData";

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

  it("finds only links connected to a selected node", () => {
    const links = new Float32Array([0, 1, 2, 0, 1, 2]);

    expect(findConnectedLinkIndices(links, 0)).toEqual([0, 1]);
    expect(findConnectedLinkIndices(links, 1)).toEqual([0, 2]);
    expect(findConnectedLinkIndices(links, 3)).toEqual([]);
  });
});
