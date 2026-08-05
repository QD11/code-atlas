import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "~/app/App";
import { AppThemeProvider } from "~/app/AppThemeProvider";
import { GlobalStyles } from "~/app/GlobalStyles";

const root = document.querySelector("#root");

if (!root) {
  throw new Error("Code Atlas root element was not found");
}

createRoot(root).render(
  <StrictMode>
    <AppThemeProvider>
      <GlobalStyles />
      <App />
    </AppThemeProvider>
  </StrictMode>,
);
