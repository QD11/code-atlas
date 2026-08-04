import { spawn } from "node:child_process";

export interface GitCommandResult {
  exitCode: number;
  stdout: Buffer;
  stderr: string;
}

export function runGit(
  arguments_: readonly string[],
  cwd: string,
): Promise<GitCommandResult> {
  return new Promise((resolve, reject) => {
    const child = spawn("git", arguments_, {
      cwd,
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
    });
    const stdoutChunks: Buffer[] = [];
    const stderrChunks: Buffer[] = [];

    child.stdout.on("data", (chunk: Buffer) => {
      stdoutChunks.push(chunk);
    });
    child.stderr.on("data", (chunk: Buffer) => {
      stderrChunks.push(chunk);
    });
    child.once("error", reject);
    child.once("close", (exitCode) => {
      resolve({
        exitCode: exitCode ?? 1,
        stdout: Buffer.concat(stdoutChunks),
        stderr: Buffer.concat(stderrChunks).toString("utf8"),
      });
    });
  });
}
