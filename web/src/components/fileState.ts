import type { ProjectSnapshotNode } from "@shared/project-snapshot.js";
import type { ThemeValues } from "~/app/theme";
import { graphColorFromHex, type GraphColor } from "~/components/graphData";

export type FileState =
  "changed" | "directImpact" | "transitiveImpact" | "unchanged";

export interface FileStateLegendItem {
  label: string;
  state: FileState;
}

export const FILE_STATE_LEGEND: readonly FileStateLegendItem[] = [
  { state: "changed", label: "Changed" },
  { state: "directImpact", label: "Direct impact" },
  { state: "transitiveImpact", label: "Transitive impact" },
  { state: "unchanged", label: "Unchanged" },
];

type FileStateNode = Pick<ProjectSnapshotNode, "changeStatus" | "impactLevels">;

export function fileState(node: FileStateNode): FileState {
  if (node.changeStatus || node.impactLevels.includes("direct-change")) {
    return "changed";
  }
  if (node.impactLevels.includes("direct-impact")) return "directImpact";
  if (node.impactLevels.includes("transitive-impact")) {
    return "transitiveImpact";
  }
  return "unchanged";
}

export function fileStateGraphColor(
  state: FileState,
  colors: ThemeValues["colors"]["fileState"],
): GraphColor {
  return graphColorFromHex(colors[state]);
}
