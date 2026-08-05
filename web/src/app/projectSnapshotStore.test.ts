import { describe, expect, it, vi } from "vitest";
import {
  ProjectSnapshotStore,
  type ProjectSnapshotTransport,
  type SnapshotState,
} from "./projectSnapshotStore.js";

describe("ProjectSnapshotStore", () => {
  it("loads the initial snapshot and refreshes after snapshot events", async () => {
    const first = snapshotState(1);
    const second = snapshotState(2);
    const load = vi
      .fn<ProjectSnapshotTransport["load"]>()
      .mockResolvedValueOnce(first)
      .mockResolvedValueOnce(second);
    const events = eventTransport(load);
    const store = new ProjectSnapshotStore(events.transport);
    const listener = vi.fn();

    const unsubscribe = store.subscribe(listener);
    await settle();

    expect(store.getSnapshot()).toEqual({
      connection: "live",
      data: first,
    });

    events.emitSnapshot();
    await settle();

    expect(load).toHaveBeenCalledTimes(2);
    expect(store.getSnapshot()).toEqual({
      connection: "live",
      data: second,
    });

    unsubscribe();
    expect(events.close).toHaveBeenCalledOnce();
  });

  it("preserves the latest snapshot when the event stream reports an error", async () => {
    const current = snapshotState(3);
    const events = eventTransport(async () => current);
    const store = new ProjectSnapshotStore(events.transport);

    const unsubscribe = store.subscribe(() => undefined);
    await settle();
    events.emitError("Analysis failed");

    expect(store.getSnapshot()).toEqual({
      connection: "error",
      data: current,
      message: "Analysis failed",
    });

    unsubscribe();
  });

  it("reports initial loading failures without inventing snapshot data", async () => {
    const events = eventTransport(async () => {
      throw new Error("Analyzer unavailable");
    });
    const store = new ProjectSnapshotStore(events.transport);

    const unsubscribe = store.subscribe(() => undefined);
    await settle();

    expect(store.getSnapshot()).toEqual({
      connection: "error",
      message: "Analyzer unavailable",
    });

    unsubscribe();
  });
});

function eventTransport(
  load: ProjectSnapshotTransport["load"],
): {
  close: ReturnType<typeof vi.fn>;
  emitError: (message: string) => void;
  emitSnapshot: () => void;
  transport: ProjectSnapshotTransport;
} {
  const close = vi.fn();
  let handlers:
    | Parameters<ProjectSnapshotTransport["subscribe"]>[0]
    | undefined;

  return {
    close,
    emitError(message) {
      handlers?.onError(message);
    },
    emitSnapshot() {
      handlers?.onSnapshot();
    },
    transport: {
      load,
      subscribe(nextHandlers) {
        handlers = nextHandlers;
        return { close };
      },
    },
  };
}

function snapshotState(revision: number): SnapshotState {
  return {
    revision,
    snapshot: {
      projectRoot: "/project",
      hasChanges: false,
      hasExportChanges: false,
      graph: {
        nodes: [],
        edges: [],
      },
      changedFiles: [],
      diagnostics: {
        project: [],
        git: [],
        exports: [],
      },
    },
  };
}

async function settle(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
}
