export type GraphColor = readonly [
  red: number,
  green: number,
  blue: number,
  alpha: number,
];

export interface GraphNode {
  id: string;
  color?: GraphColor;
  size?: number;
}

export interface GraphEdge {
  source: string;
  target: string;
  color?: GraphColor;
  directed?: boolean;
  width?: number;
}

export interface CosmosGraphData {
  linkArrows: boolean[];
  linkColors: Float32Array;
  links: Float32Array;
  linkWidths: Float32Array;
  nodeIndices: Map<string, number>;
  pointColors: Float32Array;
  pointPositions: Float32Array;
  pointSizes: Float32Array;
}

export function buildCosmosGraphData(
  nodes: readonly GraphNode[],
  edges: readonly GraphEdge[],
): CosmosGraphData {
  const nodeIndices = new Map<string, number>();

  const pointPositions = new Float32Array(nodes.length * 2);
  const pointColors = new Float32Array(nodes.length * 4);
  const pointSizes = new Float32Array(nodes.length);

  pointColors.fill(Number.NaN);
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
  const linkWidths = new Float32Array(resolvedEdges.length);
  const linkArrows: boolean[] = [];

  linkColors.fill(Number.NaN);
  linkWidths.fill(Number.NaN);

  resolvedEdges.forEach(({ edge, source, target }, index) => {
    links[index * 2] = source;
    links[index * 2 + 1] = target;
    linkWidths[index] = edge.width ?? Number.NaN;
    linkArrows.push(edge.directed ?? true);

    if (edge.color) {
      linkColors.set(edge.color, index * 4);
    }
  });

  return {
    linkArrows,
    linkColors,
    links,
    linkWidths,
    nodeIndices,
    pointColors,
    pointPositions,
    pointSizes,
  };
}
