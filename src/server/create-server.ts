import { access } from "node:fs/promises";
import path from "node:path";
import Fastify, { type FastifyInstance } from "fastify";
import fastifyStatic from "@fastify/static";
import {
  createProjectSnapshotService,
  type ProjectSnapshotService,
} from "~/server/project-snapshot-service.js";

export interface CreateServerOptions {
  projectRoot: string;
  staticRoot?: string;
  snapshotService?: ProjectSnapshotService;
  watch?: boolean;
}

export async function createServer({
  projectRoot,
  staticRoot,
  snapshotService: providedSnapshotService,
  watch,
}: CreateServerOptions): Promise<FastifyInstance> {
  const app = Fastify({
    logger: false,
  });
  const snapshotService =
    providedSnapshotService ??
    (await createProjectSnapshotService({ projectRoot, watch }));
  const ownsSnapshotService = !providedSnapshotService;

  app.addHook("onRequest", async (request, reply) => {
    if (!request.url.startsWith("/api/")) return;

    reply.header("Cache-Control", "no-store");
    reply.header("X-Content-Type-Options", "nosniff");

    if (
      !isLoopbackAuthority(request.headers.host) ||
      !isAllowedOrigin(request.headers.origin)
    ) {
      return reply.code(403).send({
        error: "Code Atlas API is available only to the local application",
      });
    }
  });

  app.get("/api/health", async () => ({
    ok: true,
    projectRoot,
  }));

  app.get("/api/snapshot", async () => snapshotService.getState());

  app.get("/api/events", async (request, reply) => {
    reply.hijack();
    reply.raw.writeHead(200, {
      "Cache-Control": "no-cache, no-store",
      Connection: "keep-alive",
      "Content-Type": "text/event-stream; charset=utf-8",
      "X-Accel-Buffering": "no",
      "X-Content-Type-Options": "nosniff",
    });
    writeEvent(reply.raw, "ready", {
      revision: snapshotService.getState().revision,
    });

    const unsubscribe = snapshotService.subscribe((event) => {
      if (event.type === "snapshot") {
        writeEvent(reply.raw, "snapshot", {
          revision: event.state.revision,
        });
      } else {
        writeEvent(reply.raw, "analysis-error", {
          revision: event.revision,
          message: event.message,
        });
      }
    });
    reply.raw.once("close", unsubscribe);
  });

  app.addHook("onClose", async () => {
    if (ownsSnapshotService) await snapshotService.close();
  });

  if (staticRoot && (await directoryExists(staticRoot))) {
    await app.register(fastifyStatic, {
      root: staticRoot,
      wildcard: false,
    });

    app.setNotFoundHandler(async (request, reply) => {
      if (request.url.startsWith("/api/")) {
        return reply.code(404).send({ error: "Not found" });
      }

      return reply.sendFile("index.html");
    });
  }

  return app;
}

function writeEvent(
  stream: NodeJS.WritableStream,
  eventName: string,
  data: unknown,
): void {
  stream.write(formatServerSentEvent(eventName, data));
}

export function formatServerSentEvent(
  eventName: string,
  data: unknown,
): string {
  return `event: ${eventName}\ndata: ${JSON.stringify(data)}\n\n`;
}

function isAllowedOrigin(origin: string | undefined): boolean {
  if (!origin) return true;

  try {
    return isLoopbackHostname(new URL(origin).hostname);
  } catch {
    return false;
  }
}

function isLoopbackAuthority(authority: string | undefined): boolean {
  if (!authority) return false;

  try {
    return isLoopbackHostname(new URL(`http://${authority}`).hostname);
  } catch {
    return false;
  }
}

function isLoopbackHostname(hostname: string): boolean {
  return (
    hostname === "localhost" || hostname === "::1" || isIpv4Loopback(hostname)
  );
}

function isIpv4Loopback(hostname: string): boolean {
  const octets = hostname.split(".");
  return (
    octets.length === 4 &&
    octets[0] === "127" &&
    octets.every(
      (octet) =>
        /^\d{1,3}$/.test(octet) && Number(octet) >= 0 && Number(octet) <= 255,
    )
  );
}

async function directoryExists(directory: string): Promise<boolean> {
  try {
    await access(path.resolve(directory));
    return true;
  } catch {
    return false;
  }
}
