import styled from "styled-components";
import { tokens } from "~/app/theme";
import { Canvas } from "~/components/Canvas";
import { LeftPanel } from "~/components/LeftPanel";
import { RightPanel } from "~/components/RightPanel";

export function App() {
  return (
    <Shell>
      <Header>
        <BrandMark aria-hidden="true">CA</BrandMark>
        <Brand>Code Atlas</Brand>
        <Project>Project workspace</Project>
      </Header>

      <Workspace>
        <LeftPanel />
        <Canvas />
        <RightPanel />
      </Workspace>
    </Shell>
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
  border: 1px solid
    color-mix(in srgb, ${tokens.colors.accent} 55%, transparent);
  border-radius: 7px;
  color: ${tokens.colors.accentText};
  background: color-mix(
    in srgb,
    ${tokens.colors.accent} 10%,
    transparent
  );
  font-size: ${tokens.typography.size.xs};
  font-weight: ${tokens.typography.weight.bold};
`;

const Brand = styled.span`
  font-size: ${tokens.typography.size.sm};
  font-weight: ${tokens.typography.weight.semibold};
  letter-spacing: ${tokens.typography.letterSpacing.tight};
`;

const Project = styled.span`
  margin-left: auto;
  color: ${tokens.colors.textMuted};
  font-size: ${tokens.typography.size.xs};
`;

const Workspace = styled.div`
  min-height: 0;
  display: grid;
  grid-template-columns: 260px minmax(0, 1fr) 300px;

  @media (max-width: 1100px) {
    grid-template-columns: 220px minmax(0, 1fr) 260px;
  }
`;
