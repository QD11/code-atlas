import { Button as BaseButton } from "@base-ui/react/button";
import styled from "styled-components";
import { tokens } from "~/app/theme";

export const Button = styled(BaseButton)`
  min-height: 32px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  padding: 0 10px;
  border: 1px solid ${tokens.colors.border};
  border-radius: 6px;
  color: ${tokens.colors.textMuted};
  background: ${tokens.colors.surfaceRaised};
  font-size: ${tokens.typography.size.sm};
  font-weight: ${tokens.typography.weight.medium};
  cursor: pointer;

  &:hover {
    color: ${tokens.colors.text};
  }

  &:focus-visible {
    outline: 2px solid ${tokens.colors.accent};
    outline-offset: -1px;
  }

  &:disabled {
    opacity: 0.45;
    cursor: default;
  }
`;
