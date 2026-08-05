import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { ThemeProvider } from "styled-components";
import { themes, tokens, type ColorMode } from "~/app/theme";

interface ColorModeControl {
  mode: ColorMode;
  toggleMode: () => void;
}

interface AppThemeProviderProps {
  children: ReactNode;
}

const ColorModeContext = createContext<ColorModeControl | undefined>(undefined);

export function AppThemeProvider({ children }: AppThemeProviderProps) {
  const [mode, setMode] = useState<ColorMode>(systemColorMode);

  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const updateMode = () => setMode(media.matches ? "dark" : "light");

    media.addEventListener("change", updateMode);
    return () => media.removeEventListener("change", updateMode);
  }, []);

  const toggleMode = () =>
    setMode((current) => (current === "dark" ? "light" : "dark"));

  return (
    <ColorModeContext.Provider value={{ mode, toggleMode }}>
      <ThemeProvider theme={themes[mode]}>
        <tokens.GlobalStyle />
        {children}
      </ThemeProvider>
    </ColorModeContext.Provider>
  );
}

export function useColorMode(): ColorModeControl {
  const control = useContext(ColorModeContext);
  if (!control) {
    throw new Error("useColorMode must be used within AppThemeProvider");
  }
  return control;
}

function systemColorMode(): ColorMode {
  if (typeof window === "undefined") return "dark";
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}
