import path from "node:path";
import ts from "typescript";
import type { ModuleResolutionDiagnostic } from "~/shared/module-reference-resolution.js";

export interface TypeScriptProjectConfig {
  compilerOptions: ts.CompilerOptions;
  diagnostics: ModuleResolutionDiagnostic[];
}

const defaultCompilerOptions: ts.CompilerOptions = {
  allowJs: true,
  jsx: ts.JsxEmit.Preserve,
  module: ts.ModuleKind.NodeNext,
  moduleResolution: ts.ModuleResolutionKind.NodeNext,
  noEmit: true,
  target: ts.ScriptTarget.ESNext,
};

export function loadTypeScriptProjectConfig(
  projectRoot: string,
): TypeScriptProjectConfig {
  const absoluteProjectRoot = path.resolve(projectRoot);
  const configPath = projectConfigPath(absoluteProjectRoot);

  if (!configPath) {
    return {
      compilerOptions: { ...defaultCompilerOptions },
      diagnostics: [],
    };
  }

  const configFile = ts.readConfigFile(configPath, ts.sys.readFile);
  if (configFile.error) {
    return {
      compilerOptions: { ...defaultCompilerOptions },
      diagnostics: [configDiagnostic(configFile.error)],
    };
  }

  const parsedConfig = ts.parseJsonConfigFileContent(
    configFile.config,
    ts.sys,
    path.dirname(configPath),
    undefined,
    configPath,
  );

  return {
    compilerOptions: {
      ...parsedConfig.options,
      allowJs: true,
      noEmit: true,
    },
    diagnostics: parsedConfig.errors.map(configDiagnostic),
  };
}

function projectConfigPath(projectRoot: string): string | undefined {
  for (const fileName of ["tsconfig.json", "jsconfig.json"]) {
    const candidate = path.join(projectRoot, fileName);
    if (ts.sys.fileExists(candidate)) return candidate;
  }

  return undefined;
}

function configDiagnostic(
  diagnostic: ts.Diagnostic,
): ModuleResolutionDiagnostic {
  return {
    severity: "warning",
    message: ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n"),
  };
}
