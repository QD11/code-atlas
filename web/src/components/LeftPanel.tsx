import styled from "styled-components";
import { tokens } from "~/app/theme";

export function LeftPanel() {
  return (
    <Panel aria-label="Project panel">
      <PanelHeader>
        <Title>Project</Title>
        <Description>Files and search will live here.</Description>
      </PanelHeader>
      <EmptyState>Left panel</EmptyState>
    </Panel>
  );
}

const Panel = styled.aside`
  min-width: 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
  border-right: 1px solid ${tokens.colors.border};
  background: ${tokens.colors.surface};
`;

const PanelHeader = styled.header`
  padding: 15px 13px;
  border-bottom: 1px solid ${tokens.colors.border};
`;

const Title = styled.h2`
  margin: 0;
  font-size: ${tokens.typography.size.sm};
  font-weight: ${tokens.typography.weight.semibold};
`;

const Description = styled.p`
  margin: 5px 0 0;
  color: ${tokens.colors.textMuted};
  font-size: ${tokens.typography.size.xs};
  line-height: ${tokens.typography.lineHeight.normal};
`;

const EmptyState = styled.div`
  flex: 1;
  display: grid;
  place-items: center;
  color: ${tokens.colors.textMuted};
  font-size: ${tokens.typography.size.sm};
`;
