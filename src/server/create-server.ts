import { access } from "node:fs/promises";
import path from "node:path";
import Fastify, { type FastifyInstance } from "fastify";
import fastifyStatic from "@fastify/static";

export interface CreateServerOptions {
  projectRoot: string;
  staticRoot?: string;
}

export async function createServer({
  projectRoot,
  staticRoot,
}: CreateServerOptions): Promise<FastifyInstance> {
  const app = Fastify({
    logger: false,
  });

  app.get("/api/health", async () => ({
    ok: true,
    projectRoot,
  }));

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

async function directoryExists(directory: string): Promise<boolean> {
  try {
    await access(path.resolve(directory));
    return true;
  } catch {
    return false;
  }
}
