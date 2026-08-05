import { createContext } from "react";

export const SectionDepthContext = createContext(0);

export function nextSectionDepth(parentDepth: number): number {
  return Math.min(parentDepth + 1, 6);
}

export function headingLevelForDepth(depth: number): HeadingLevel {
  return Math.max(1, Math.min(depth, 6)) as HeadingLevel;
}

export type HeadingLevel = 1 | 2 | 3 | 4 | 5 | 6;
