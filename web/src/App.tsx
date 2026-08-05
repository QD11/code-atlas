import { useEffect, useState } from "react";

interface HealthResponse {
  ok: boolean;
  projectRoot: string;
}

type Connection =
  | { status: "connecting" }
  | { status: "ready"; health: HealthResponse }
  | { status: "error" };

export function App() {
  const [connection, setConnection] = useState<Connection>({
    status: "connecting",
  });

  useEffect(() => {
    const controller = new AbortController();

    fetch("/api/health", { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error("Local server is unavailable");
        return (await response.json()) as HealthResponse;
      })
      .then((health) => setConnection({ status: "ready", health }))
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setConnection({ status: "error" });
      });

    return () => controller.abort();
  }, []);

  return (
    <main className="shell">
      <header className="topbar">
        <a className="brand" href="/" aria-label="Code Atlas home">
          <span className="brand-mark" aria-hidden="true">
            CA
          </span>
          <span>Code Atlas</span>
        </a>
        <span
          className={`connection connection--${connection.status}`}
          aria-live="polite"
        >
          {connection.status === "ready"
            ? "Local server connected"
            : connection.status === "error"
              ? "Local server unavailable"
              : "Connecting…"}
        </span>
      </header>

      <section className="workspace">
        <div className="intro">
          <p className="eyebrow">Development environment</p>
          <h1>The workspace is ready.</h1>
          <p className="lede">
            The CLI, local server, React client, and Git-backed sample project
            are connected. Product features will land independently from this
            clean baseline.
          </p>

          <dl className="project-card">
            <div>
              <dt>Selected project</dt>
              <dd>
                {connection.status === "ready"
                  ? connection.health.projectRoot
                  : "Waiting for the local server"}
              </dd>
            </div>
            <div>
              <dt>Graph status</dt>
              <dd>Not implemented yet</dd>
            </div>
          </dl>
        </div>

        <div className="canvas-placeholder" aria-label="Future graph canvas">
          <div className="orbit orbit--large" />
          <div className="orbit orbit--small" />
          <span className="node node--one" />
          <span className="node node--two" />
          <span className="node node--three" />
          <p>Project graph canvas</p>
        </div>
      </section>
    </main>
  );
}
