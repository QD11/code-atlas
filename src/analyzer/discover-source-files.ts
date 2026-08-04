import { readdir } from "node:fs/promises";
import path from "node:path";
import {
  SUPPORTED_SOURCE_EXTENSIONS,
  type FileNode,
  type SourceFileExtension,
} from "~/shared/file-node.js";

export const DEFAULT_IGNORED_DIRECTORY_NAMES = [
  ".git",
  ".next",
  ".nuxt",
  ".output",
  "build",
  "coverage",
  "dist",
  "node_modules",
  "out",
] as const;

export interface DiscoverSourceFilesOptions {
  additionalIgnoredDirectoryNames?: readonly string[];
}

const supportedExtensions = new Set<string>(SUPPORTED_SOURCE_EXTENSIONS);

export async function discoverSourceFiles(
  projectRoot: string,
  options: DiscoverSourceFilesOptions = {},
): Promise<FileNode[]> {
  const absoluteProjectRoot = path.resolve(projectRoot);
  const ignoredDirectoryNames = new Set<string>([
    ...DEFAULT_IGNORED_DIRECTORY_NAMES,
    ...(options.additionalIgnoredDirectoryNames ?? []),
  ]);
  const files: FileNode[] = [];

  await visitDirectory(absoluteProjectRoot);

  return files.toSorted((left, right) => compareText(left.path, right.path));

  async function visitDirectory(directory: string): Promise<void> {
    const entries = await readdir(directory, { withFileTypes: true });
    entries.sort((left, right) => compareText(left.name, right.name));

    for (const entry of entries) {
      if (entry.isDirectory()) {
        if (!ignoredDirectoryNames.has(entry.name)) {
          await visitDirectory(path.join(directory, entry.name));
        }
        continue;
      }

      if (!entry.isFile()) continue;

      const extension = sourceFileExtension(entry.name);
      if (!extension) continue;

      const absoluteFilePath = path.join(directory, entry.name);
      const relativePath = normalizeProjectPath(
        path.relative(absoluteProjectRoot, absoluteFilePath),
      );

      files.push({
        id: relativePath,
        path: relativePath,
        name: entry.name,
        extension,
      });
    }
  }
}

function sourceFileExtension(fileName: string): SourceFileExtension | undefined {
  const extension = path.extname(fileName).toLowerCase();

  return supportedExtensions.has(extension)
    ? (extension as SourceFileExtension)
    : undefined;
}

function normalizeProjectPath(filePath: string): string {
  return filePath.split(path.sep).join("/");
}

function compareText(left: string, right: string): number {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}
