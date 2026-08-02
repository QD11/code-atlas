import { renderAddPage } from "./add-page.js";
import { renderSubtractPage } from "./subtract-page.js";

export function renderApp(): string {
  return [renderAddPage(), renderSubtractPage()].join("\n");
}
