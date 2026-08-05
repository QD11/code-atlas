import styled from "styled-components";
import { tokens } from "~/app/theme";

export function Canvas() {
  return (
    <Surface aria-label="Graph canvas">
      <Placeholder>
        <Title>Graph canvas</Title>
        <Description>Cosmos.gl will render the project graph here.</Description>
      </Placeholder>
    </Surface>
  );
}

const Surface = styled.main`
  position: relative;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
  display: grid;
  place-items: center;
  background:
    linear-gradient(rgb(255 255 255 / 2.5%) 1px, transparent 1px),
    linear-gradient(90deg, rgb(255 255 255 / 2.5%) 1px, transparent 1px),
    ${tokens.colors.canvas};
  background-size: 24px 24px;
`;

const Placeholder = styled.div`
  padding: 20px 24px;
  border: 1px solid ${tokens.colors.border};
  border-radius: 10px;
  background: color-mix(
    in srgb,
    ${tokens.colors.surface} 88%,
    transparent
  );
  text-align: center;
`;

const Title = styled.h1`
  margin: 0;
  font-size: ${tokens.typography.size.md};
  font-weight: ${tokens.typography.weight.semibold};
`;

const Description = styled.p`
  margin: 7px 0 0;
  color: ${tokens.colors.textMuted};
  font-size: ${tokens.typography.size.sm};
  line-height: ${tokens.typography.lineHeight.normal};
`;
