import { describe, expect, it } from "vitest";
import { parseCliArguments } from "../src/cli/arguments.js";

describe("parseCliArguments", () => {
  it("uses local-first defaults", () => {
    expect(parseCliArguments([])).toEqual({
      help: false,
      noOpen: false,
      port: 43110,
      projectPath: ".",
      version: false,
    });
  });

  it("accepts a project directory and server options", () => {
    expect(
      parseCliArguments(["./example", "--port", "44000", "--no-open"]),
    ).toMatchObject({
      noOpen: true,
      port: 44000,
      projectPath: "./example",
    });
  });

  it("rejects invalid ports", () => {
    expect(() => parseCliArguments(["--port=70000"])).toThrow("Invalid port");
  });
});
