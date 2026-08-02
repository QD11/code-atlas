import { subtract } from "./math.js";

export function renderSubtractPage(): string {
  return `5 - 3 = ${subtract(5, 3)}`;
}
