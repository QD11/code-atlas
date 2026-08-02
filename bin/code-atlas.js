#!/usr/bin/env node

import { readFileSync } from "node:fs";

const packageJson = JSON.parse(
  readFileSync(new URL("../package.json", import.meta.url), "utf8"),
);

const help = `Code Atlas ${packageJson.version}

Visualize how exported-symbol changes affect a JavaScript or TypeScript project.

Usage:
  code-atlas [path]
  code-atlas --help
  code-atlas --version

Code Atlas is in early development. The project analyzer and interactive graph
are not available in this preview.

Project: https://github.com/QD11/code-atlas
`;

const args = process.argv.slice(2);

if (args.includes("--version") || args.includes("-v")) {
  console.log(packageJson.version);
} else {
  console.log(help);
}
