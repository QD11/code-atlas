import { createHash } from "node:crypto";

const ignoredAstKeys = new Set([
  "end",
  "loc",
  "parent",
  "range",
  "raw",
  "start",
]);

export function createStructuralFingerprint(value: unknown): string {
  return createHash("sha256")
    .update(stableSerialize(value))
    .digest("hex");
}

function stableSerialize(value: unknown): string {
  if (value === null) return "null";

  switch (typeof value) {
    case "string":
    case "boolean":
      return JSON.stringify(value);
    case "number":
      return Number.isFinite(value) ? String(value) : JSON.stringify(String(value));
    case "bigint":
      return JSON.stringify({ bigint: value.toString() });
    case "undefined":
      return JSON.stringify({ undefined: true });
    case "object":
      if (Array.isArray(value)) {
        return `[${value.map(stableSerialize).join(",")}]`;
      }

      return serializeObject(value as Readonly<Record<string, unknown>>);
    default:
      return JSON.stringify(String(value));
  }
}

function serializeObject(value: Readonly<Record<string, unknown>>): string {
  const entries = Object.entries(value)
    .filter(
      ([key, propertyValue]) =>
        !ignoredAstKeys.has(key) && propertyValue !== undefined,
    )
    .toSorted(([left], [right]) => compareText(left, right));

  return `{${entries
    .map(
      ([key, propertyValue]) =>
        `${JSON.stringify(key)}:${stableSerialize(propertyValue)}`,
    )
    .join(",")}}`;
}

function compareText(left: string, right: string): number {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}
