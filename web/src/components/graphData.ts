export type GraphColor = readonly [
  red: number,
  green: number,
  blue: number,
  alpha: number,
];

export interface GraphNode {
  id: string;
  color?: GraphColor;
  name?: string;
  size?: number;
}

export interface GraphEdge {
  source: string;
  target: string;
  color?: GraphColor;
  directed?: boolean;
  style?: GraphLinkStyle;
  width?: number;
}

export enum GraphLinkStyle {
  Solid = 0,
  Dashed = 1,
  Dotted = 2,
}

export interface CosmosGraphData {
  linkArrows: boolean[];
  linkColors: Float32Array;
  linkStyles: Float32Array;
  links: Float32Array;
  linkWidths: Float32Array;
  nodeIndices: Map<string, number>;
  pointColors: Float32Array;
  pointPositions: Float32Array;
  pointSizes: Float32Array;
}

export interface SelectedLinkAppearance {
  linkColors: Float32Array;
  linkStyles: Float32Array;
  linkWidths: Float32Array;
}

export function buildCosmosGraphData(
  nodes: readonly GraphNode[],
  edges: readonly GraphEdge[],
): CosmosGraphData {
  const nodeIndices = new Map<string, number>();

  const pointPositions = new Float32Array(nodes.length * 2);
  const pointColors = buildPointColors(
    nodes.length,
    nodes.map(({ color }) => color),
  );
  const pointSizes = new Float32Array(nodes.length);

  pointSizes.fill(Number.NaN);

  nodes.forEach((node, index) => {
    if (!nodeIndices.has(node.id)) nodeIndices.set(node.id, index);

    const radius = 28 * Math.sqrt(index);
    const angle = index * Math.PI * (3 - Math.sqrt(5));
    pointPositions[index * 2] = Math.cos(angle) * radius;
    pointPositions[index * 2 + 1] = Math.sin(angle) * radius;
    pointSizes[index] = node.size ?? Number.NaN;

    if (node.color) {
      pointColors.set(node.color, index * 4);
    }
  });

  const resolvedEdges = edges.flatMap((edge) => {
    const source = nodeIndices.get(edge.source);
    const target = nodeIndices.get(edge.target);
    return source === undefined || target === undefined
      ? []
      : [{ edge, source, target }];
  });

  const links = new Float32Array(resolvedEdges.length * 2);
  const linkColors = new Float32Array(resolvedEdges.length * 4);
  const linkStyles = new Float32Array(resolvedEdges.length);
  const linkWidths = new Float32Array(resolvedEdges.length);
  const linkArrows: boolean[] = [];

  linkColors.fill(Number.NaN);
  linkStyles.fill(Number.NaN);
  linkWidths.fill(Number.NaN);

  resolvedEdges.forEach(({ edge, source, target }, index) => {
    links[index * 2] = source;
    links[index * 2 + 1] = target;
    linkStyles[index] = edge.style ?? Number.NaN;
    linkWidths[index] = edge.width ?? Number.NaN;
    linkArrows.push(edge.directed ?? true);

    if (edge.color) {
      linkColors.set(edge.color, index * 4);
    }
  });

  return {
    linkArrows,
    linkColors,
    linkStyles,
    links,
    linkWidths,
    nodeIndices,
    pointColors,
    pointPositions,
    pointSizes,
  };
}

export function buildPointColors(
  pointCount: number,
  colors: readonly (GraphColor | undefined)[],
): Float32Array {
  const pointColors = new Float32Array(pointCount * 4);
  pointColors.fill(Number.NaN);

  colors.slice(0, pointCount).forEach((color, index) => {
    if (color) pointColors.set(color, index * 4);
  });

  return pointColors;
}

export function buildSelectedLinkAppearance(
  data: Pick<
    CosmosGraphData,
    "linkColors" | "linkStyles" | "links" | "linkWidths" | "nodeIndices"
  >,
  selectedNodeId: string | undefined,
  selectedColor: GraphColor,
): SelectedLinkAppearance {
  const linkColors = data.linkColors.slice();
  const linkStyles = data.linkStyles.slice();
  const linkWidths = data.linkWidths.slice();
  const selectedIndex = selectedNodeId
    ? data.nodeIndices.get(selectedNodeId)
    : undefined;

  if (selectedIndex === undefined) {
    return { linkColors, linkStyles, linkWidths };
  }

  for (let linkIndex = 0; linkIndex < data.links.length / 2; linkIndex += 1) {
    const sourceIndex = data.links[linkIndex * 2];
    const targetIndex = data.links[linkIndex * 2 + 1];
    const relationshipStyle =
      sourceIndex === selectedIndex
        ? GraphLinkStyle.Solid
        : targetIndex === selectedIndex
          ? GraphLinkStyle.Dashed
          : undefined;

    if (relationshipStyle === undefined) continue;
    linkColors.set(selectedColor, linkIndex * 4);
    linkStyles[linkIndex] = relationshipStyle;
    linkWidths[linkIndex] = 3;
  }

  return { linkColors, linkStyles, linkWidths };
}

export function graphColorFromHex(hex: string): GraphColor {
  const match = /^#([\da-f]{2})([\da-f]{2})([\da-f]{2})$/i.exec(hex);
  const red = match?.[1];
  const green = match?.[2];
  const blue = match?.[3];

  if (!red || !green || !blue) {
    throw new Error(`Invalid graph color: ${hex}`);
  }

  return [
    Number.parseInt(red, 16) / 255,
    Number.parseInt(green, 16) / 255,
    Number.parseInt(blue, 16) / 255,
    1,
  ];
}

export function findConnectedLinkIndices(
  links: Float32Array,
  selectedNodeIndex: number,
): number[] {
  const connectedLinkIndices: number[] = [];

  for (let linkIndex = 0; linkIndex < links.length / 2; linkIndex += 1) {
    const sourceIndex = links[linkIndex * 2];
    const targetIndex = links[linkIndex * 2 + 1];

    if (
      sourceIndex === selectedNodeIndex ||
      targetIndex === selectedNodeIndex
    ) {
      connectedLinkIndices.push(linkIndex);
    }
  }

  return connectedLinkIndices;
}

export function findConnectedPointIndices(
  links: Float32Array,
  selectedNodeIndex: number,
): number[] {
  const connectedPointIndices = new Set([selectedNodeIndex]);

  for (let linkIndex = 0; linkIndex < links.length / 2; linkIndex += 1) {
    const sourceIndex = links[linkIndex * 2];
    const targetIndex = links[linkIndex * 2 + 1];

    if (sourceIndex === selectedNodeIndex && targetIndex !== undefined) {
      connectedPointIndices.add(targetIndex);
    }
    if (targetIndex === selectedNodeIndex && sourceIndex !== undefined) {
      connectedPointIndices.add(sourceIndex);
    }
  }

  return [...connectedPointIndices];
}
