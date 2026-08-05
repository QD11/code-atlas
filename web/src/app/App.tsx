import { useState } from "react";
import styled from "styled-components";
import { useColorMode } from "~/app/AppThemeProvider";
import { LeftPanel } from "~/app/LeftPanel";
import { useProjectSnapshot } from "~/app/projectSnapshotStore";
import { RightPanel } from "~/app/RightPanel";
import { tokens } from "~/app/theme";
import { Canvas } from "~/components/Canvas";
import { Button } from "~/components/ui";

export function App() {
  const { mode, toggleMode } = useColorMode();
  const { connection, data, message } = useProjectSnapshot();
  const [selectedFileId, setSelectedFileId] = useState<string>();
  const [isRightPanelOpen, setIsRightPanelOpen] = useState(true);
  const nodes = data?.snapshot.graph.nodes ?? [];
  const edges = data?.snapshot.graph.edges ?? [];
  const selectedFile = nodes.find(({ id }) => id === selectedFileId);
  const projectLabel = data
    ? projectName(data.snapshot.projectRoot)
    : "Waiting for project";
  const changeLabel = data
    ? data.snapshot.hasChanges
      ? "Working changes detected"
      : "No current changes"
    : "Connecting to local analyzer";

  return (
    <Shell>
      <Header>
        <BrandMark aria-hidden="true">CA</BrandMark>
        <Brand>Code Atlas</Brand>
        <ModeButton
          aria-label={`Use ${mode === "dark" ? "light" : "dark"} mode`}
          onClick={toggleMode}
          type="button"
        >
          <ModeIcon aria-hidden="true">{mode === "dark" ? "☀" : "☾"}</ModeIcon>
          {mode === "dark" ? "Light" : "Dark"}
        </ModeButton>
        <ProjectStatus>
          <Project>{projectLabel}</Project>
          <ChangeStatus $hasChanges={data?.snapshot.hasChanges}>
            {changeLabel}
          </ChangeStatus>
        </ProjectStatus>
      </Header>

      <Workspace>
        <LeftPanel />
        <Canvas
          connection={connection}
          edges={edges}
          message={message}
          nodes={nodes}
          onFileSelect={(fileId) => {
            setSelectedFileId(fileId);
            if (fileId) setIsRightPanelOpen(true);
          }}
          selectedFileId={selectedFile?.id}
        />
        <RightPanel
          edges={edges}
          isOpen={isRightPanelOpen}
          nodes={nodes}
          onOpenChange={setIsRightPanelOpen}
          selectedFile={selectedFile}
        />
      </Workspace>
    </Shell>
  );
}

function projectName(projectRoot: string): string {
  return (
    projectRoot.split(/[/\\]/).filter(Boolean).at(-1) ?? "Project workspace"
  );
}

const Shell = styled.div`
  height: 100dvh;
  display: grid;
  grid-template-rows: 44px minmax(0, 1fr);
`;

const Header = styled.header`
  display: flex;
  align-items: center;
  gap: 9px;
  padding: 0 12px;
  border-bottom: 1px solid ${tokens.colors.border};
  background: ${tokens.colors.surface};
`;

const BrandMark = styled.span`
  width: 25px;
  height: 25px;
  display: grid;
  place-items: center;
  border: 1px solid color-mix(in srgb, ${tokens.colors.accent} 55%, transparent);
  border-radius: 7px;
  color: ${tokens.colors.accentText};
  background: color-mix(in srgb, ${tokens.colors.accent} 10%, transparent);
  font-size: ${tokens.typography.size.xs};
  font-weight: ${tokens.typography.weight.bold};
`;

const Brand = styled.span`
  font-size: ${tokens.typography.size.sm};
  font-weight: ${tokens.typography.weight.semibold};
  letter-spacing: ${tokens.typography.letterSpacing.tight};
`;

const ModeButton = styled(Button)`
  min-height: 28px;
  margin-left: 5px;
  padding: 0 8px;
  font-size: ${tokens.typography.size.xs};
`;

const ModeIcon = styled.span`
  font-size: ${tokens.typography.size.sm};
  line-height: 1;
`;

const ProjectStatus = styled.div`
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 9px;
  margin-left: auto;
`;

const Project = styled.span`
  overflow: hidden;
  color: ${tokens.colors.text};
  font-family: ${tokens.typography.family.mono};
  font-size: ${tokens.typography.size.xs};
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const ChangeStatus = styled.span<{ $hasChanges?: boolean }>`
  padding-left: 9px;
  border-left: 1px solid ${tokens.colors.border};
  color: ${tokens.colors.textMuted};
  font-size: ${tokens.typography.size.xs};
  white-space: nowrap;

  &::before {
    width: 6px;
    height: 6px;
    display: inline-block;
    margin-right: 5px;
    border-radius: 50%;
    background: ${({ $hasChanges }) =>
      $hasChanges ? tokens.colors.accent : tokens.colors.textMuted};
    content: "";
  }
`;

const Workspace = styled.div`
  min-height: 0;
  display: grid;
  grid-template-columns: 260px minmax(0, 1fr) auto;

  @media (max-width: 1100px) {
    grid-template-columns: 220px minmax(0, 1fr) auto;
  }
`;
