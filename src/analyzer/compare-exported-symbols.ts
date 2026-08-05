import type { ExportedSymbolChange } from "~/shared/exported-symbol-change.js";
import type { ExportedSymbol } from "~/shared/exported-symbol.js";

export function compareExportedSymbols(
  headExports: readonly ExportedSymbol[],
  workingExports: readonly ExportedSymbol[],
): ExportedSymbolChange[] {
  const headByIdentity = indexExports(headExports);
  const workingByIdentity = indexExports(workingExports);
  const identities = new Set([
    ...headByIdentity.keys(),
    ...workingByIdentity.keys(),
  ]);
  const changes: ExportedSymbolChange[] = [];

  for (const identity of [...identities].toSorted(compareText)) {
    const before = headByIdentity.get(identity);
    const after = workingByIdentity.get(identity);

    if (!before && after) {
      changes.push({
        status: "added",
        name: after.name,
        after,
      });
    } else if (before && !after) {
      changes.push({
        status: "removed",
        name: before.name,
        before,
      });
    } else if (before && after && before.fingerprint !== after.fingerprint) {
      changes.push({
        status: "modified",
        name: after.name,
        before,
        after,
      });
    }
  }

  return changes;
}

function indexExports(
  exportedSymbols: readonly ExportedSymbol[],
): Map<string, ExportedSymbol> {
  return new Map(
    exportedSymbols.map((symbol) => [exportIdentity(symbol), symbol]),
  );
}

function exportIdentity(symbol: ExportedSymbol): string {
  if (symbol.kind === "star-re-export") {
    return [
      "star",
      symbol.source ?? "",
      symbol.isTypeOnly ? "type" : "value",
    ].join("\0");
  }

  return ["named", symbol.name, symbol.isTypeOnly ? "type" : "value"].join(
    "\0",
  );
}

function compareText(left: string, right: string): number {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}
