import styled from "styled-components";
import { tokens } from "~/app/theme";

export const Tag = styled.span`
  display: inline-flex;
  flex: none;
  align-items: center;
  padding: 2px 6px;
  border: 1px solid
    color-mix(in srgb, ${tokens.colors.accent} 45%, ${tokens.colors.border});
  border-radius: 999px;
  color: ${tokens.colors.accentText};
  background: color-mix(in srgb, ${tokens.colors.accent} 10%, transparent);
  font-size: ${tokens.typography.size.xs};
  font-weight: ${tokens.typography.weight.medium};
  line-height: ${tokens.typography.lineHeight.tight};
`;
