import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  createServer,
  formatServerSentEvent,
} from "../src/server/create-server.js";

describe("local server", () => {
  it("reports the selected project root", async () => {
    const projectRoot = path.resolve("test-projects/sample-project-template/base");
    const app = await createServer({ projectRoot, watch: false });

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

  it("serves the current analysis snapshot without raw source text", async () => {
    const projectRoot = path.resolve(
      "test-projects/sample-project-template/base",
    );
    const app = await createServer({ projectRoot, watch: false });

    const response = await app.inject({
      method: "GET",
      url: "/api/snapshot",
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers["cache-control"]).toBe("no-store");
    expect(response.json()).toMatchObject({
      revision: 1,
      snapshot: {
        projectRoot,
        graph: {
          nodes: expect.any(Array),
          edges: expect.any(Array),
        },
      },
    });
    expect(response.body).not.toContain("return left + right");

    await app.close();
  });

  it("rejects non-loopback hosts and browser origins", async () => {
    const projectRoot = path.resolve(
      "test-projects/sample-project-template/base",
    );
    const app = await createServer({ projectRoot, watch: false });

    const remoteHost = await app.inject({
      method: "GET",
      url: "/api/snapshot",
      headers: { host: "example.com" },
    });
    const remoteOrigin = await app.inject({
      method: "GET",
      url: "/api/snapshot",
      headers: {
        host: "127.0.0.1:43110",
        origin: "https://example.com",
      },
    });
    const localOrigin = await app.inject({
      method: "GET",
      url: "/api/snapshot",
      headers: {
        host: "127.0.0.1:43110",
        origin: "http://localhost:5173",
      },
    });

    expect(remoteHost.statusCode).toBe(403);
    expect(remoteOrigin.statusCode).toBe(403);
    expect(localOrigin.statusCode).toBe(200);

    await app.close();
  });

  it("formats revision-only event notifications", () => {
    const contents = formatServerSentEvent("snapshot", {
      revision: 2,
    });

    expect(contents).toBe(
      'event: snapshot\ndata: {"revision":2}\n\n',
    );
    expect(contents).not.toContain("projectRoot");
    expect(contents).not.toContain("nodes");
  });
});
