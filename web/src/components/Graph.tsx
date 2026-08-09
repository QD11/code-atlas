import {
  type Ref,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Graph as CosmosGraph,
  type GraphConfig as CosmosGraphConfig,
} from "@cosmos.gl/graph";
import styled, { useTheme } from "styled-components";
import { tokens } from "~/app/theme";
import {
  buildCosmosGraphData,
  buildPointColors,
  buildSelectedLinkAppearance,
  findConnectedLinkIndices,
  findConnectedPointIndices,
  graphColorFromHex,
  type CosmosGraphData,
  type GraphColor,
  type GraphEdge,
  type GraphNode,
} from "~/components/graphData";

export type { GraphColor, GraphEdge, GraphNode } from "~/components/graphData";

export interface GraphHandle {
  fitView(): void;
}

export interface GraphProps {
  edges: readonly GraphEdge[];
  id: string;
  label?: string;
  nodeColors?: readonly (GraphColor | undefined)[];
  nodes: readonly GraphNode[];
  onNodeSelect?: (nodeId: string | undefined) => void;
  ref?: Ref<GraphHandle>;
  selectedNodeId?: string;
  simulationEnabled?: boolean;
}

interface HoveredNode {
  label: string;
  x: number;
  y: number;
}

type RendererStatus = "loading" | "ready" | "error";

const SIMULATION_START_ALPHA = 0.4;

const GRAPH_CONFIG: CosmosGraphConfig = {
  attribution: "cosmos.gl",
  curvedLinks: false,
  enableDrag: true,
  enableSimulation: false,
  hoveredPointCursor: "pointer",
  linkArrowsSizeScale: 1,
  linkDefaultArrows: true,
  linkDefaultWidth: 1,
  linkGreyoutOpacity: 0.06,
  linkOpacity: 0.32,
  pointDefaultSize: 16,
  pointGreyoutOpacity: 0.35,
  pointSizeScale: 1,
  randomSeed: "code-atlas",
  renderHoveredPointRing: true,
  simulationCollision: 0.35,
  simulationCollisionPadding: 3,
  simulationFriction: 0.4,
  simulationGravity: 0.04,
  simulationLinkDistance: 48,
  simulationLinkSpring: 0.2,
  simulationRepulsion: 0.65,
};

export function Graph({
  edges,
  id,
  label = "Graph visualization",
  nodeColors,
  nodes,
  onNodeSelect,
  ref,
  selectedNodeId,
  simulationEnabled = true,
}: GraphProps) {
  const theme = useTheme();

  const containerRef = useRef<HTMLDivElement>(null);

  const graphRef = useRef<CosmosGraph | undefined>(undefined);

  const [rendererAvailable, setRendererAvailable] = useState(false);

  const [hoveredNode, setHoveredNode] = useState<HoveredNode>();

  const [status, setStatus] = useState<RendererStatus>(
    nodes.length === 0 ? "ready" : "loading",
  );

  const graphData = useMemo(
    () => buildCosmosGraphData(nodes, edges),
    [edges, nodes],
  );
  const pointColorOverride = useMemo(
    () => (nodeColors ? buildPointColors(nodes.length, nodeColors) : undefined),
    [nodeColors, nodes.length],
  );
  const hasSelectedNode =
    selectedNodeId !== undefined && graphData.nodeIndices.has(selectedNodeId);
  const selectedLinkAppearance = useMemo(
    () =>
      buildSelectedLinkAppearance(
        graphData,
        selectedNodeId,
        graphColorFromHex(theme.colors.relationship.selected),
      ),
    [graphData, selectedNodeId, theme.colors.relationship],
  );

  useImperativeHandle(
    ref,
    () => ({
      fitView() {
        graphRef.current?.fitView();
      },
    }),
    [],
  );

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let cancelled = false;

    const graph = new CosmosGraph(container, GRAPH_CONFIG);

    graphRef.current = graph;
    setRendererAvailable(true);

    void graph.ready
      .then(() => {
        if (cancelled) return;
        setStatus("ready");
      })
      .catch(() => {
        if (!cancelled) setStatus("error");
      });

    return () => {
      cancelled = true;
      graphRef.current = undefined;
      graph?.destroy();
    };
  }, []);

  useEffect(() => {
    const graph = graphRef.current;
    if (!graph) return;

    applyGraphData(graph, graphData);
  }, [graphData, rendererAvailable]);

  useEffect(() => {
    const graph = graphRef.current;
    if (!graph || !pointColorOverride) return;

    graph.setPointColors(pointColorOverride);
    graph.render(undefined, 0);
  }, [pointColorOverride, rendererAvailable]);

  useEffect(() => {
    const graph = graphRef.current;
    if (!graph) return;

    graph.setLinkColors(selectedLinkAppearance.linkColors);
    graph.setLinkStyles(selectedLinkAppearance.linkStyles);
    graph.setLinkWidths(selectedLinkAppearance.linkWidths);
    graph.render(undefined, 0);
  }, [rendererAvailable, selectedLinkAppearance]);

  useEffect(() => {
    const graph = graphRef.current;
    if (!graph) return;

    graph.setConfigPartial({ enableSimulation: simulationEnabled });
    if (simulationEnabled && graphData.pointPositions.length > 0) {
      graph.start(SIMULATION_START_ALPHA);
    }
  }, [graphData, rendererAvailable, simulationEnabled]);

  useEffect(() => {
    graphRef.current?.setConfigPartial({
      backgroundColor: theme.colors.canvas,
      focusedPointRingColor: theme.colors.text,
      hoveredPointRingColor: theme.colors.text,
      linkDefaultColor: theme.colors.textMuted,
      linkDefaultWidth: GRAPH_CONFIG.linkDefaultWidth,
      linkOpacity: hasSelectedNode ? 1 : GRAPH_CONFIG.linkOpacity,
      outlinedPointRingColor: theme.colors.accentText,
      pointDefaultColor: theme.colors.accent,
    });
  }, [hasSelectedNode, rendererAvailable, theme]);

  useEffect(() => {
    const graph = graphRef.current;
    if (!graph) return;

    applySelection(graph, graphData, selectedNodeId);
  }, [graphData, rendererAvailable, selectedNodeId]);

  useEffect(() => {
    const graph = graphRef.current;
    if (!graph) return;

    graph.setConfigPartial({
      onBackgroundClick: () => onNodeSelect?.(undefined),
      onMouseMove: (index, _pointPosition, event) => {
        const node = index === undefined ? undefined : nodes[index];
        const bounds = containerRef.current?.getBoundingClientRect();

        if (!node || !bounds) {
          setHoveredNode(undefined);
          return;
        }

        setHoveredNode({
          label: node.name ?? node.id,
          x: event.clientX - bounds.left,
          y: event.clientY - bounds.top,
        });
      },
      onPointClick: (index) => onNodeSelect?.(nodes[index]?.id),
    });
  }, [nodes, onNodeSelect, rendererAvailable]);

  const showEmptyState = status === "ready" && nodes.length === 0;

  return (
    <Surface
      aria-busy={status === "loading"}
      aria-label={label}
      id={id}
      onMouseLeave={() => setHoveredNode(undefined)}
      role="region"
    >
      <GraphHost ref={containerRef} />

      {hoveredNode ? (
        <NodeTooltip $x={hoveredNode.x} $y={hoveredNode.y} aria-hidden="true">
          {hoveredNode.label}
        </NodeTooltip>
      ) : null}

      {status === "loading" ? (
        <Status aria-live="polite">Rendering graph…</Status>
      ) : null}
      {status === "error" ? (
        <Status role="alert">
          This browser could not initialize the graph renderer.
        </Status>
      ) : null}
      {showEmptyState ? <Status>No graph data</Status> : null}
    </Surface>
  );
}

function applyGraphData(
  graph: CosmosGraph,
  data: CosmosGraphData | undefined,
): void {
  if (!data) return;

  graph.setPointPositions(data.pointPositions);
  graph.setPointColors(data.pointColors);
  graph.setPointSizes(data.pointSizes);
  graph.setLinks(data.links);
  graph.setLinkColors(data.linkColors);
  graph.setLinkStyles(data.linkStyles);
  graph.setLinkWidths(data.linkWidths);
  graph.setLinkArrows(data.linkArrows);

  graph.render(undefined, 0);
}

function applySelection(
  graph: CosmosGraph,
  data: CosmosGraphData | undefined,
  selectedNodeId: string | undefined,
): void {
  const selectedIndex =
    selectedNodeId && data ? data.nodeIndices.get(selectedNodeId) : undefined;
  const connectedLinkIndices =
    selectedIndex === undefined || !data
      ? undefined
      : findConnectedLinkIndices(data.links, selectedIndex);
  const connectedPointIndices =
    selectedIndex === undefined || !data
      ? undefined
      : findConnectedPointIndices(data.links, selectedIndex);

  graph.setConfigPartial({
    focusedPointIndex: selectedIndex,
    highlightedLinkIndices: connectedLinkIndices,
    highlightedPointIndices: connectedPointIndices,
    outlinedPointIndices:
      selectedIndex === undefined ? undefined : [selectedIndex],
  });
}

const Surface = styled.div`
  position: relative;
  width: 100%;
  height: 100%;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
  background: ${tokens.colors.canvas};
`;

const GraphHost = styled.div`
  position: absolute;
  inset: 0;
`;

const NodeTooltip = styled.div<{ $x: number; $y: number }>`
  position: absolute;
  z-index: 3;
  top: ${({ $y }) => `${$y}px`};
  left: ${({ $x }) => `${$x}px`};
  max-width: min(20rem, calc(100% - 2rem));
  padding: 0.3rem 0.45rem;
  overflow: hidden;
  border: 1px solid ${tokens.colors.border};
  border-radius: 5px;
  color: ${tokens.colors.text};
  background: ${tokens.colors.surfaceRaised};
  box-shadow: 0 4px 14px
    color-mix(in srgb, ${tokens.colors.background} 35%, transparent);
  font-family: ${tokens.typography.family.mono};
  font-size: ${tokens.typography.size.xs};
  line-height: ${tokens.typography.lineHeight.tight};
  pointer-events: none;
  text-overflow: ellipsis;
  transform: translate(-50%, calc(-100% - 0.75rem));
  white-space: nowrap;
`;

const Status = styled.div`
  position: absolute;
  top: 50%;
  left: 50%;
  padding: 9px 12px;
  border: 1px solid ${tokens.colors.border};
  border-radius: 7px;
  color: ${tokens.colors.textMuted};
  background: color-mix(in srgb, ${tokens.colors.surface} 90%, transparent);
  font-size: ${tokens.typography.size.sm};
  transform: translate(-50%, -50%);
`;
