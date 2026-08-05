import { createTheme } from "styled-components";

export interface ThemeValues {
  colors: {
    background: string;
    surface: string;
    surfaceRaised: string;
    canvas: string;
    border: string;
    text: string;
    textMuted: string;
    accent: string;
    accentText: string;
  };
  typography: {
    family: {
      sans: string;
      mono: string;
    };
    size: {
      xs: string;
      sm: string;
      md: string;
      lg: string;
      xl: string;
    };
    weight: {
      regular: number;
      medium: number;
      semibold: number;
      bold: number;
    };
    lineHeight: {
      tight: number;
      normal: number;
      relaxed: number;
    };
    letterSpacing: {
      tight: string;
      normal: string;
      wide: string;
    };
  };
}

const typography: ThemeValues["typography"] = {
  family: {
    sans:
      'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    mono:
      '"SFMono-Regular", "Cascadia Code", Consolas, "Liberation Mono", monospace',
  },
  size: {
    xs: "10px",
    sm: "12px",
    md: "14px",
    lg: "16px",
    xl: "20px",
  },
  weight: {
    regular: 400,
    medium: 500,
    semibold: 600,
    bold: 700,
  },
  lineHeight: {
    tight: 1.2,
    normal: 1.5,
    relaxed: 1.7,
  },
  letterSpacing: {
    tight: "-0.015em",
    normal: "0",
    wide: "0.04em",
  },
};

export const darkTheme: ThemeValues = {
  colors: {
    background: "#0c0d10",
    surface: "#121317",
    surfaceRaised: "#181a20",
    canvas: "#0e1014",
    border: "#292c33",
    text: "#f0f1f3",
    textMuted: "#858b96",
    accent: "#758bff",
    accentText: "#a4b2ff",
  },
  typography,
};

export const lightTheme: ThemeValues = {
  colors: {
    background: "#f5f6f8",
    surface: "#ffffff",
    surfaceRaised: "#f0f1f4",
    canvas: "#f8f9fb",
    border: "#d9dce2",
    text: "#191b20",
    textMuted: "#69707c",
    accent: "#536de5",
    accentText: "#4058c9",
  },
  typography,
};

export const themes = {
  dark: darkTheme,
  light: lightTheme,
} as const;

export const tokens = createTheme(darkTheme, {
  prefix: "atlas",
});

export type ColorMode = keyof typeof themes;
