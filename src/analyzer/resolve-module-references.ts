import { isBuiltin } from "node:module";
import path from "node:path";
import ts from "typescript";
import type { FileNode } from "~/shared/file-node.js";
import type { ModuleReference } from "~/shared/module-reference.js";
import type {
  ModuleReferenceResolution,
  ModuleResolutionDiagnostic,
  ResolveModuleReferencesResult,
} from "~/shared/module-reference-resolution.js";

export interface CreateModuleResolverOptions {
  projectRoot: string;
  projectFiles: readonly FileNode[];
  compilerOptions: ts.CompilerOptions;
}

export interface ModuleResolver {
  resolve(
    sourceFile: FileNode,
    references: readonly ModuleReference[],
  ): ResolveModuleReferencesResult;
}

export function createModuleResolver({
  projectRoot,
  projectFiles,
  compilerOptions,
}: CreateModuleResolverOptions): ModuleResolver {
  const absoluteProjectRoot = path.resolve(projectRoot);
  const projectFileByAbsolutePath = new Map(
    projectFiles.map((file) => [
      normalizeAbsolutePath(path.resolve(absoluteProjectRoot, file.path)),
      file,
    ]),
  );
  const moduleResolutionCache = ts.createModuleResolutionCache(
    absoluteProjectRoot,
    (fileName) =>
      ts.sys.useCaseSensitiveFileNames ? fileName : fileName.toLowerCase(),
    compilerOptions,
  );

  return {
    resolve(sourceFile, references) {
      const diagnostics: ModuleResolutionDiagnostic[] = [];
      const absoluteSourceFile = path.resolve(
        absoluteProjectRoot,
        sourceFile.path,
      );
      const resolutions = references.map((reference) => {
        const resolution = resolveReference(
          sourceFile,
          absoluteSourceFile,
          reference,
        );

        if (resolution.status === "unresolved") {
          diagnostics.push({
            severity: "warning",
            message: `Could not resolve module "${reference.specifier}"`,
            sourceFile: sourceFile.path,
            specifier: reference.specifier,
          });
        } else if (resolution.status === "unsupported") {
          diagnostics.push({
            severity: "warning",
            message: `Module "${reference.specifier}" resolved to an unsupported project file`,
            sourceFile: sourceFile.path,
            specifier: reference.specifier,
          });
        }

        return resolution;
      });

      return { resolutions, diagnostics };
    },
  };

  function resolveReference(
    sourceFile: FileNode,
    absoluteSourceFile: string,
    reference: ModuleReference,
  ): ModuleReferenceResolution {
    const baseResolution = {
      sourceFile: sourceFile.path,
      reference,
    };

    if (isBuiltin(reference.specifier)) {
      return {
        ...baseResolution,
        status: "external",
      };
    }

    const typescriptResolution = resolveWithTypeScript(
      reference.specifier,
      absoluteSourceFile,
      compilerOptions,
      moduleResolutionCache,
    );
    const resolvedFileName = typescriptResolution?.resolvedFileName;

    if (resolvedFileName) {
      const absoluteResolvedFile = normalizeAbsolutePath(resolvedFileName);
      const projectFile = projectFileByAbsolutePath.get(absoluteResolvedFile);

      if (projectFile) {
        return {
          ...baseResolution,
          status: "internal",
          targetFile: projectFile.path,
        };
      }

      if (isInsideProject(absoluteProjectRoot, absoluteResolvedFile)) {
        return {
          ...baseResolution,
          status: "unsupported",
          targetFile: normalizeProjectPath(
            path.relative(absoluteProjectRoot, absoluteResolvedFile),
          ),
        };
      }

      return {
        ...baseResolution,
        status: "external",
      };
    }

    const fallbackFile = resolveProjectFileCandidate(
      reference.specifier,
      absoluteSourceFile,
      projectFileByAbsolutePath,
    );

    if (fallbackFile) {
      return {
        ...baseResolution,
        status: "internal",
        targetFile: fallbackFile.path,
      };
    }

    if (
      isPathSpecifier(reference.specifier) ||
      matchesPathAlias(reference.specifier, compilerOptions.paths) ||
      reference.specifier.startsWith("#")
    ) {
      return {
        ...baseResolution,
        status: "unresolved",
      };
    }

    return {
      ...baseResolution,
      status: "external",
    };
  }
}

function resolveWithTypeScript(
  specifier: string,
  containingFile: string,
  compilerOptions: ts.CompilerOptions,
  cache: ts.ModuleResolutionCache,
): ts.ResolvedModuleFull | undefined {
  return ts.resolveModuleName(
    specifier,
    containingFile,
    compilerOptions,
    ts.sys,
    cache,
  ).resolvedModule;
}

function resolveProjectFileCandidate(
  specifier: string,
  containingFile: string,
  projectFileByAbsolutePath: ReadonlyMap<string, FileNode>,
): FileNode | undefined {
  if (!isPathSpecifier(specifier)) return undefined;

  const basePath = path.isAbsolute(specifier)
    ? specifier
    : path.resolve(path.dirname(containingFile), specifier);

  for (const candidate of candidateFilePaths(basePath)) {
    const file = projectFileByAbsolutePath.get(normalizeAbsolutePath(candidate));
    if (file) return file;
  }

  return undefined;
}

function candidateFilePaths(basePath: string): string[] {
  const extension = path.extname(basePath).toLowerCase();
  const candidates = new Set<string>([basePath]);

  if (extension === ".js") {
    const stem = basePath.slice(0, -extension.length);
    candidates.add(`${stem}.ts`);
    candidates.add(`${stem}.tsx`);
    candidates.add(`${stem}.d.ts`);
    candidates.add(`${stem}.jsx`);
  } else if (extension === ".jsx") {
    const stem = basePath.slice(0, -extension.length);
    candidates.add(`${stem}.tsx`);
  } else if (extension === ".mjs") {
    const stem = basePath.slice(0, -extension.length);
    candidates.add(`${stem}.mts`);
    candidates.add(`${stem}.d.mts`);
  } else if (extension === ".cjs") {
    const stem = basePath.slice(0, -extension.length);
    candidates.add(`${stem}.cts`);
    candidates.add(`${stem}.d.cts`);
  } else if (!extension) {
    for (const candidateExtension of [
      ".ts",
      ".tsx",
      ".mts",
      ".cts",
      ".js",
      ".jsx",
      ".mjs",
      ".cjs",
    ]) {
      candidates.add(`${basePath}${candidateExtension}`);
      candidates.add(path.join(basePath, `index${candidateExtension}`));
    }
    candidates.add(`${basePath}.d.ts`);
    candidates.add(path.join(basePath, "index.d.ts"));
  }

  return [...candidates];
}

function matchesPathAlias(
  specifier: string,
  paths: ts.MapLike<string[]> | undefined,
): boolean {
  if (!paths) return false;

  return Object.keys(paths).some((pattern) => {
    const wildcardIndex = pattern.indexOf("*");
    if (wildcardIndex === -1) return pattern === specifier;

    const prefix = pattern.slice(0, wildcardIndex);
    const suffix = pattern.slice(wildcardIndex + 1);
    return specifier.startsWith(prefix) && specifier.endsWith(suffix);
  });
}

function isPathSpecifier(specifier: string): boolean {
  return (
    specifier.startsWith("./") ||
    specifier.startsWith("../") ||
    path.isAbsolute(specifier)
  );
}

function isInsideProject(projectRoot: string, filePath: string): boolean {
  const relativePath = path.relative(projectRoot, filePath);
  return (
    relativePath !== ".." &&
    !relativePath.startsWith(`..${path.sep}`) &&
    !path.isAbsolute(relativePath)
  );
}

function normalizeAbsolutePath(filePath: string): string {
  return path.normalize(path.resolve(filePath));
}

function normalizeProjectPath(filePath: string): string {
  return filePath.split(path.sep).join("/");
}
