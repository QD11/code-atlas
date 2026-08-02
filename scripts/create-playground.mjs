import { cp, mkdir, rm } from "node:fs/promises";
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const templateRoot = path.join(
  repositoryRoot,
  "test-projects",
  "sample-project-template",
);
const playgroundRoot = path.join(repositoryRoot, ".playground");
const projectRoot = path.join(playgroundRoot, "sample-project");

async function runGit(args) {
  await new Promise((resolve, reject) => {
    const child = spawn("git", args, {
      cwd: projectRoot,
      stdio: "inherit",
    });

    child.once("error", reject);
    child.once("exit", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`git ${args.join(" ")} exited with code ${code}`));
      }
    });
  });
}

await rm(projectRoot, { recursive: true, force: true });
await mkdir(playgroundRoot, { recursive: true });
await cp(path.join(templateRoot, "base"), projectRoot, { recursive: true });

await runGit(["init", "--initial-branch=main"]);
await runGit(["config", "user.name", "Code Atlas Fixture"]);
await runGit(["config", "user.email", "fixture@code-atlas.local"]);
await runGit(["add", "."]);
await runGit(["commit", "-m", "Baseline fixture"]);

await cp(path.join(templateRoot, "working"), projectRoot, {
  recursive: true,
  force: true,
});

console.log(`\nPlayground ready: ${projectRoot}`);
console.log("The working tree modifies src/math.ts after the baseline commit.");
