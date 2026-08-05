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
  type CosmosGraphData,
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
  nodes: readonly GraphNode[];
  onNodeSelect?: (nodeId: string | undefined) => void;
  ref?: Ref<GraphHandle>;
  selectedNodeId?: string;
  simulationEnabled?: boolean;
}

type RendererStatus = "loading" | "ready" | "error";

const GRAPH_CONFIG: CosmosGraphConfig = {
  attribution: "cosmos.gl",
  curvedLinks: true,
  enableDrag: true,
  enableSimulation: false,
  hoveredPointCursor: "pointer",
  linkDefaultArrows: true,
  linkDefaultWidth: 3,
  linkOpacity: 0.55,
  pointDefaultSize: 16,
  pointGreyoutOpacity: 0.35,
  pointSizeScale: 1,
  randomSeed: "code-atlas",
  renderHoveredPointRing: true,
  simulationCollision: 1,
  simulationCollisionPadding: 2,
  simulationFriction: 0.6,
  simulationGravity: 0.12,
  simulationLinkDistance: 20,
  simulationLinkSpring: 0.8,
  simulationRepulsion: 0.7,
  curvedLinkControlPointDistance: 1,
};

export function Graph({
  edges,
  id,
  label = "Graph visualization",
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

  const [status, setStatus] = useState<RendererStatus>(
    nodes.length === 0 ? "ready" : "loading",
  );

  const graphData = useMemo(
    () => buildCosmosGraphData(nodes, edges),
    [edges, nodes],
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
    if (!graph) return;

    graph.setConfigPartial({ enableSimulation: simulationEnabled });
    if (simulationEnabled && graphData.pointPositions.length > 0) {
      graph.start(0.8);
    }
  }, [graphData, rendererAvailable, simulationEnabled]);

  useEffect(() => {
    graphRef.current?.setConfigPartial({
      backgroundColor: theme.colors.canvas,
      focusedPointRingColor: theme.colors.text,
      hoveredPointRingColor: theme.colors.text,
      linkDefaultColor: theme.colors.textMuted,
      outlinedPointRingColor: theme.colors.accentText,
      pointDefaultColor: theme.colors.accent,
    });
  }, [rendererAvailable, theme]);

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
      onPointClick: (index) => onNodeSelect?.(nodes[index]?.id),
    });
  }, [nodes, onNodeSelect, rendererAvailable]);

  const showEmptyState = status === "ready" && nodes.length === 0;

  return (
    <Surface
      aria-busy={status === "loading"}
      aria-label={label}
      id={id}
      role="region"
    >
      <GraphHost ref={containerRef} />

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

  graph.setConfigPartial({
    focusedPointIndex: selectedIndex,
    highlightedPointIndices:
      selectedIndex === undefined ? undefined : [selectedIndex],
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
