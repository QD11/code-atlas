import { access } from "node:fs/promises";
import { spawn } from "node:child_process";
import path from "node:path";
import process from "node:process";
import open from "open";

const target = path.resolve(
  process.argv[2] ?? path.join(".playground", "sample-project"),
);

try {
  await access(target);
} catch {
  console.error(`Project not found: ${target}`);
  console.error("Create it first with: npm run playground");
  process.exit(1);
}

const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";
const children = [
  spawn(npmCommand, ["run", "dev:server", "--", target], {
    stdio: "inherit",
  }),
  spawn(npmCommand, ["run", "dev:web"], {
    stdio: "inherit",
  }),
];

let stopping = false;

function stop(exitCode = 0) {
  if (stopping) return;
  stopping = true;
  for (const child of children) child.kill("SIGTERM");
  process.exitCode = exitCode;
}

for (const child of children) {
  child.once("error", (error) => {
    console.error(error);
    stop(1);
  });
  child.once("exit", (code, signal) => {
    if (!stopping && signal !== "SIGTERM") stop(code ?? 1);
  });
}

process.once("SIGINT", () => stop());
process.once("SIGTERM", () => stop());

const appUrl = "http://127.0.0.1:5173";
for (let attempt = 0; attempt < 40; attempt += 1) {
  try {
    const response = await fetch(appUrl);
    if (response.ok) {
      console.log(`\nCode Atlas: ${appUrl}`);
      await open(appUrl);
      break;
    }
  } catch {
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
}
