import path from "node:path";
import { describe, expect, it } from "vitest";
import { createServer } from "../src/server/create-server.js";

describe("local server", () => {
  it("reports the selected project root", async () => {
    const projectRoot = path.resolve("test-projects/sample-project-template/base");
    const app = await createServer({ projectRoot });

    const response = await app.inject({
      method: "GET",
      url: "/api/health",
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      ok: true,
      projectRoot,
    });

    await app.close();
  });
});
