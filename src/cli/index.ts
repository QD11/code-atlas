import { access, stat } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath, pathToFileURL } from "node:url";
import open from "open";
import packageJson from "../../package.json" with { type: "json" };
import { createServer } from "../server/create-server.js";
import { parseCliArguments } from "./arguments.js";

const HELP = `Code Atlas

Usage:
  code-atlas [project-directory] [options]

Options:
  --port <number>  Local server port (default: 43110)
  --no-open        Do not open the browser automatically
  -h, --help       Show this help
  -v, --version    Show the installed version
`;

export async function main(arguments_ = process.argv.slice(2)): Promise<void> {
  let options;

  try {
    options = parseCliArguments(arguments_);
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
    return;
  }

  if (options.help) {
    console.log(HELP);
    return;
  }

  if (options.version) {
    console.log(packageJson.version);
    return;
  }

  const projectRoot = path.resolve(options.projectPath);

  try {
    await access(projectRoot);
    if (!(await stat(projectRoot)).isDirectory()) {
      throw new Error("The project path is not a directory");
    }
  } catch (error) {
    const message = error instanceof Error ? ` (${error.message})` : "";
    console.error(`Cannot open project: ${projectRoot}${message}`);
    process.exitCode = 1;
    return;
  }

  const moduleDirectory = path.dirname(fileURLToPath(import.meta.url));
  const staticRoot = path.resolve(moduleDirectory, "web");
  const app = await createServer({ projectRoot, staticRoot });

  await app.listen({
    host: "127.0.0.1",
    port: options.port,
  });

  const url = `http://127.0.0.1:${options.port}`;
  console.log(`Code Atlas ${packageJson.version}`);
  console.log(`Project: ${projectRoot}`);
  console.log(`Local app: ${url}`);

  if (!options.noOpen) {
    await open(url);
  }

  const shutdown = async () => {
    await app.close();
  };

  process.once("SIGINT", shutdown);
  process.once("SIGTERM", shutdown);
}

const entryPath = process.argv[1]
  ? pathToFileURL(path.resolve(process.argv[1])).href
  : undefined;

if (entryPath === import.meta.url) {
  await main();
}
