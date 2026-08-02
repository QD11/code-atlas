import { add } from "./math.js";

export function renderAddPage(): string {
  return `2 + 3 = ${add(2, 3)}`;
}
