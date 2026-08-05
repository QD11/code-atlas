export const SUPPORTED_SOURCE_EXTENSIONS = [
  ".js",
  ".jsx",
  ".ts",
  ".tsx",
  ".mjs",
  ".cjs",
  ".mts",
  ".cts",
] as const;

export type SourceFileExtension = (typeof SUPPORTED_SOURCE_EXTENSIONS)[number];

export interface FileNode {
  /**
   * Stable project-local identifier. It currently matches `path`.
   */
  id: string;
  /**
   * POSIX-style path relative to the analyzed project root.
   */
  path: string;
  name: string;
  extension: SourceFileExtension;
}
