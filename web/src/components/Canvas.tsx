import { useRef } from "react";
import type {
  ProjectSnapshotEdge,
  ProjectSnapshotNode,
} from "@shared/project-snapshot.js";
import styled, { keyframes } from "styled-components";
import { tokens } from "~/app/theme";
import { Graph, type GraphHandle } from "~/components/Graph";
import { Button } from "~/components/ui";

interface CanvasProps {
  connection: "connecting" | "live" | "error";
  edges: ProjectSnapshotEdge[];
  message?: string;
  nodes: ProjectSnapshotNode[];
}

export function Canvas({ connection, edges, message, nodes }: CanvasProps) {
  const graphRef = useRef<GraphHandle>(null);
  const isLoading = connection === "connecting" && nodes.length === 0;
  const hasSnapshot = nodes.length > 0;

  return (
    <Surface aria-label="Project graph canvas">
      <Toolbar>
        <Stat>
          <strong>{nodes.length}</strong> files
        </Stat>
        <Stat>
          <strong>{edges.length}</strong> imports
        </Stat>
        <ToolbarSpacer />
        {hasSnapshot ? (
          <Button onClick={() => graphRef.current?.fitView()} type="button">
            Fit view
          </Button>
        ) : null}
        <Connection $connection={connection}>
          {connection === "live"
            ? "Live"
            : connection === "error"
              ? "Connection issue"
              : "Connecting"}
        </Connection>
      </Toolbar>

      {hasSnapshot ? (
        <Graph
          edges={edges}
          id="project-dependency-graph"
          label={`Project dependency graph with ${nodes.length} ${
            nodes.length === 1 ? "file" : "files"
          } and ${edges.length} ${edges.length === 1 ? "import" : "imports"}`}
          nodes={nodes}
          ref={graphRef}
          simulationEnabled
        />
      ) : (
        <Status aria-busy={isLoading} aria-live="polite" role="status">
          {isLoading ? <LoadingSpinner aria-hidden="true" /> : null}
          <StatusTitle>
            {isLoading
              ? "Loading project data"
              : connection === "error"
                ? "Could not load project data"
                : "No supported files found"}
          </StatusTitle>
          <StatusDescription>
            {message ??
              "Code Atlas is connected to the local project analyzer."}
          </StatusDescription>
        </Status>
      )}
    </Surface>
  );
}

const Surface = styled.main`
  position: relative;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
  background:
    linear-gradient(
      color-mix(in srgb, ${tokens.colors.border} 28%, transparent) 1px,
      transparent 1px
    ),
    linear-gradient(
      90deg,
      color-mix(in srgb, ${tokens.colors.border} 28%, transparent) 1px,
      transparent 1px
    ),
    ${tokens.colors.canvas};
  background-size: 24px 24px;
`;

const Toolbar = styled.div`
  position: absolute;
  z-index: 2;
  top: 10px;
  right: 10px;
  left: 10px;
  min-height: 40px;
  display: flex;
  align-items: center;
  gap: 9px;
  padding: 4px 12px;
  border: 1px solid ${tokens.colors.border};
  border-radius: 8px;
  background: color-mix(in srgb, ${tokens.colors.surface} 88%, transparent);
  backdrop-filter: blur(12px);
`;

const Stat = styled.span`
  color: ${tokens.colors.textMuted};
  font-size: ${tokens.typography.size.xs};

  & + & {
    padding-left: 9px;
    border-left: 1px solid ${tokens.colors.border};
  }

  strong {
    color: ${tokens.colors.text};
    font-family: ${tokens.typography.family.mono};
    font-weight: ${tokens.typography.weight.semibold};
  }
`;

const ToolbarSpacer = styled.span`
  flex: 1;
`;

const Connection = styled.span<{
  $connection: CanvasProps["connection"];
}>`
  color: ${({ $connection }) =>
    $connection === "error" ? tokens.colors.accent : tokens.colors.textMuted};
  font-size: ${tokens.typography.size.xs};
`;

const Status = styled.div`
  position: absolute;
  top: 50%;
  left: 50%;
  width: min(340px, calc(100% - 60px));
  padding: 20px 24px;
  border: 1px solid ${tokens.colors.border};
  border-radius: 10px;
  background: color-mix(in srgb, ${tokens.colors.surface} 92%, transparent);
  transform: translate(-50%, -50%);
  text-align: center;
`;

const rotate = keyframes`
  to {
    transform: rotate(360deg);
  }
`;

const LoadingSpinner = styled.span`
  width: 28px;
  height: 28px;
  display: block;
  margin: 0 auto 12px;
  border: 3px solid color-mix(in srgb, ${tokens.colors.accent} 20%, transparent);
  border-top-color: ${tokens.colors.accent};
  border-radius: 50%;
  animation: ${rotate} 700ms linear infinite;

  @media (prefers-reduced-motion: reduce) {
    animation: none;
  }
`;

const StatusTitle = styled.h1`
  margin: 0;
  font-size: ${tokens.typography.size.md};
  font-weight: ${tokens.typography.weight.semibold};
`;

const StatusDescription = styled.p`
  margin: 7px 0 0;
  color: ${tokens.colors.textMuted};
  font-size: ${tokens.typography.size.sm};
  line-height: ${tokens.typography.lineHeight.normal};
`;
