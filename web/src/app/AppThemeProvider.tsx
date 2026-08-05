import { useEffect, useState, type ReactNode } from "react";
import { ThemeProvider } from "styled-components";
import {
  themes,
  tokens,
  type ColorMode,
} from "~/app/theme";

interface AppThemeProviderProps {
  children: ReactNode;
}

export function AppThemeProvider({ children }: AppThemeProviderProps) {
  const [mode, setMode] = useState<ColorMode>(systemColorMode);

  useEffect(() => {
    const preference = window.matchMedia("(prefers-color-scheme: dark)");
    const updateMode = () => setMode(preference.matches ? "dark" : "light");

    preference.addEventListener("change", updateMode);
    return () => preference.removeEventListener("change", updateMode);
  }, []);

  return (
    <ThemeProvider theme={themes[mode]}>
      <tokens.GlobalStyle />
      {children}
    </ThemeProvider>
  );
}

function systemColorMode(): ColorMode {
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}
