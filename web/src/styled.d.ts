import "styled-components";
import type { ThemeValues } from "~/app/theme";

declare module "styled-components" {
  export interface DefaultTheme extends ThemeValues {}
}
