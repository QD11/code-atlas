import { useSyncExternalStore } from "react";
import type { ProjectSnapshot } from "@shared/project-snapshot.js";

export interface SnapshotState {
  revision: number;
  snapshot: ProjectSnapshot;
}

export interface ProjectSnapshotViewState {
  connection: "connecting" | "live" | "error";
  data?: SnapshotState;
  message?: string;
}

interface SnapshotEventHandlers {
  onSnapshot: () => void;
  onError: (message: string) => void;
}

interface SnapshotSubscription {
  close: () => void;
}

export interface ProjectSnapshotTransport {
  load: () => Promise<SnapshotState>;
  subscribe: (handlers: SnapshotEventHandlers) => SnapshotSubscription;
}

export class ProjectSnapshotStore {
  readonly getSnapshot = (): ProjectSnapshotViewState => this.state;

  readonly subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    if (this.listeners.size === 1) this.start();

    return () => {
      this.listeners.delete(listener);
      if (this.listeners.size === 0) this.stop();
    };
  };

  private state: ProjectSnapshotViewState = {
    connection: "connecting",
  };

  private readonly listeners = new Set<() => void>();
  private eventSubscription?: SnapshotSubscription;
  private requestId = 0;
  private started = false;

  constructor(private readonly transport: ProjectSnapshotTransport) {}

  private start(): void {
    if (this.started) return;
    this.started = true;
    this.setState({
      ...this.state,
      connection: this.state.data ? "live" : "connecting",
      message: undefined,
    });

    this.eventSubscription = this.transport.subscribe({
      onSnapshot: () => void this.refresh(),
      onError: (message) => {
        if (!this.started) return;
        this.setState({
          ...this.state,
          connection: "error",
          message,
        });
      },
    });

    void this.refresh();
  }

  private stop(): void {
    if (!this.started) return;
    this.started = false;
    this.requestId += 1;
    this.eventSubscription?.close();
    this.eventSubscription = undefined;
  }

  private async refresh(): Promise<void> {
    const requestId = ++this.requestId;

    try {
      const data = await this.transport.load();
      if (!this.started || requestId !== this.requestId) return;
      this.setState({
        connection: "live",
        data,
      });
    } catch (error: unknown) {
      if (!this.started || requestId !== this.requestId) return;
      this.setState({
        ...this.state,
        connection: "error",
        message:
          error instanceof Error
            ? error.message
            : "The local analyzer is unavailable",
      });
    }
  }

  private setState(state: ProjectSnapshotViewState): void {
    this.state = state;
    for (const listener of this.listeners) listener();
  }
}

const browserTransport: ProjectSnapshotTransport = {
  async load() {
    const response = await fetch("/api/snapshot");
    if (!response.ok) {
      throw new Error(`The local analyzer returned ${response.status}`);
    }
    return (await response.json()) as SnapshotState;
  },

  subscribe(handlers) {
    const events = new EventSource("/api/events");

    events.addEventListener("snapshot", handlers.onSnapshot);
    events.addEventListener("analysis-error", (event) => {
      handlers.onError(eventMessage(event));
    });
    events.onerror = () => {
      handlers.onError("Waiting for the local analyzer to reconnect");
    };

    return {
      close: () => events.close(),
    };
  },
};

const projectSnapshotStore = new ProjectSnapshotStore(browserTransport);

export function useProjectSnapshot(): ProjectSnapshotViewState {
  return useSyncExternalStore(
    projectSnapshotStore.subscribe,
    projectSnapshotStore.getSnapshot,
    projectSnapshotStore.getSnapshot,
  );
}

function eventMessage(event: Event): string {
  if (!(event instanceof MessageEvent)) {
    return "The latest analysis did not complete";
  }

  try {
    const detail = JSON.parse(event.data as string) as { message?: string };
    return detail.message ?? "The latest analysis did not complete";
  } catch {
    return "The latest analysis did not complete";
  }
}
