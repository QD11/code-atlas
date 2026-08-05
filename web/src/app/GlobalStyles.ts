import { createGlobalStyle } from "styled-components";
import { tokens } from "~/app/theme";

export const GlobalStyles = createGlobalStyle`
  :root {
    color: ${tokens.colors.text};
    background: ${tokens.colors.background};
    font-family: ${tokens.typography.family.sans};
    font-synthesis: none;
    text-rendering: optimizeLegibility;
  }

  *,
  *::before,
  *::after {
    box-sizing: border-box;
  }

  html,
  body,
  #root {
    width: 100%;
    min-width: 800px;
    height: 100%;
    margin: 0;
  }

  body {
    overflow: hidden;
    background: ${tokens.colors.background};
  }

  button,
  input {
    font: inherit;
  }
`;
