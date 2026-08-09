import { useMemo, useRef } from "react";
import type {
  ProjectSnapshotEdge,
  ProjectSnapshotNode,
} from "@shared/project-snapshot.js";
import styled, { keyframes, useTheme } from "styled-components";
import { tokens } from "~/app/theme";
import { Graph, type GraphHandle } from "~/components/Graph";
import {
  FILE_STATE_LEGEND,
  fileState,
  fileStateGraphColor,
} from "~/components/fileState";
import { Button } from "~/components/ui/Button";

interface CanvasProps {
  connection: "connecting" | "live" | "error";
  edges: ProjectSnapshotEdge[];
  message?: string;
  nodes: ProjectSnapshotNode[];
  onFileSelect?: (fileId: string | undefined) => void;
  selectedFileId?: string;
}

export function Canvas({
  connection,
  edges,
  message,
  nodes,
  onFileSelect,
  selectedFileId,
}: CanvasProps) {
  const theme = useTheme();
  const graphRef = useRef<GraphHandle>(null);
  const isLoading = connection === "connecting" && nodes.length === 0;
  const hasSnapshot = nodes.length > 0;
  const nodeColors = useMemo(
    () =>
      nodes.map((node) =>
        fileStateGraphColor(fileState(node), theme.colors.fileState),
      ),
    [nodes, theme.colors.fileState],
  );

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
        <>
          <Graph
            edges={edges}
            id="project-dependency-graph"
            label={`Project dependency graph with ${nodes.length} ${
              nodes.length === 1 ? "file" : "files"
            } and ${edges.length} ${edges.length === 1 ? "import" : "imports"}`}
            nodeColors={nodeColors}
            nodes={nodes}
            onNodeSelect={onFileSelect}
            ref={graphRef}
            selectedNodeId={selectedFileId}
            simulationEnabled
          />
          <FileStateLegend aria-label="File state legend">
            <LegendTitle>File state</LegendTitle>
            <LegendList>
              {FILE_STATE_LEGEND.map(({ label, state }) => (
                <LegendItem key={state}>
                  <LegendSwatch
                    $color={theme.colors.fileState[state]}
                    aria-hidden="true"
                  />
                  {label}
                </LegendItem>
              ))}
            </LegendList>
            {selectedFileId ? (
              <RelationshipLegend>
                <LegendTitle>Selected edges</LegendTitle>
                <LegendList>
                  <LegendItem>
                    <LegendLine
                      $color={theme.colors.relationship.selected}
                      aria-hidden="true"
                    />
                    Imports
                  </LegendItem>
                  <LegendItem>
                    <LegendLine
                      $color={theme.colors.relationship.selected}
                      $dashed
                      aria-hidden="true"
                    />
                    Imported by
                  </LegendItem>
                </LegendList>
              </RelationshipLegend>
            ) : null}
          </FileStateLegend>
        </>
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

const FileStateLegend = styled.aside`
  position: absolute;
  z-index: 2;
  bottom: 10px;
  left: 10px;
  min-width: 8rem;
  padding: 0.625rem 0.75rem;
  border: 1px solid ${tokens.colors.border};
  border-radius: 8px;
  background: color-mix(in srgb, ${tokens.colors.surface} 88%, transparent);
  backdrop-filter: blur(12px);
`;

const LegendTitle = styled.div`
  margin-bottom: 0.5rem;
  color: ${tokens.colors.textMuted};
  font-size: ${tokens.typography.size.xs};
  font-weight: ${tokens.typography.weight.semibold};
  letter-spacing: ${tokens.typography.letterSpacing.wide};
  text-transform: uppercase;
`;

const LegendList = styled.ul`
  display: grid;
  gap: 0.375rem;
  margin: 0;
  padding: 0;
  list-style: none;
`;

const LegendItem = styled.li`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  color: ${tokens.colors.text};
  font-size: ${tokens.typography.size.xs};
`;

const LegendSwatch = styled.span<{ $color: string }>`
  width: 0.625rem;
  height: 0.625rem;
  flex: none;
  border-radius: 50%;
  background: ${({ $color }) => $color};
`;

const RelationshipLegend = styled.div`
  margin-top: 0.625rem;
  padding-top: 0.625rem;
  border-top: 1px solid ${tokens.colors.border};

  ${LegendTitle} {
    margin-bottom: 0.5rem;
  }
`;

const LegendLine = styled.span<{ $color: string; $dashed?: boolean }>`
  width: 1rem;
  height: 0;
  flex: none;
  border-top: 3px ${({ $dashed }) => ($dashed ? "dashed" : "solid")}
    ${({ $color }) => $color};
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
