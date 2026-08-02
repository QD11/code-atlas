export interface CliOptions {
  help: boolean;
  noOpen: boolean;
  port: number;
  projectPath: string;
  version: boolean;
}

export function parseCliArguments(arguments_: string[]): CliOptions {
  let projectPath = ".";
  let port = 43110;
  let noOpen = false;
  let help = false;
  let version = false;

  for (let index = 0; index < arguments_.length; index += 1) {
    const argument = arguments_[index];

    if (argument === "--help" || argument === "-h") {
      help = true;
    } else if (argument === "--version" || argument === "-v") {
      version = true;
    } else if (argument === "--no-open") {
      noOpen = true;
    } else if (argument === "--port") {
      const value = arguments_[index + 1];
      if (!value) throw new Error("--port requires a value");
      port = parsePort(value);
      index += 1;
    } else if (argument?.startsWith("--port=")) {
      port = parsePort(argument.slice("--port=".length));
    } else if (argument?.startsWith("-")) {
      throw new Error(`Unknown option: ${argument}`);
    } else if (argument) {
      projectPath = argument;
    }
  }

  return { help, noOpen, port, projectPath, version };
}

function parsePort(value: string): number {
  const port = Number(value);
  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new Error(`Invalid port: ${value}`);
  }
  return port;
}
