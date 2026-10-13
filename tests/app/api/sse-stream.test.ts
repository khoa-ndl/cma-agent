import { afterEach, describe, expect, it, vi } from "vitest";

// Real next/server's after() only works inside an active request scope,
// which a plain vitest test has none of. Mocked here to capture the
// callback instead of running it, so the test controls exactly when the
// drain happens rather than racing Next's own internals.
let afterCallback: (() => Promise<void>) | undefined;
vi.mock("next/server", () => ({
  after: (cb: () => Promise<void>) => {
    afterCallback = cb;
  },
}));

const { toSseStream } = await import("@/app/api/_lib/sse-stream");

describe("toSseStream", () => {
  afterEach(() => {
    afterCallback = undefined;
  });

  it("delivers each yielded event as an SSE message, then closes", async () => {
    async function* events() {
      yield { type: "a" };
      yield { type: "b" };
    }
    const reader = toSseStream(events()).getReader();
    const decoder = new TextDecoder();

    const first = await reader.read();
    expect(decoder.decode(first.value)).toBe('data: {"type":"a"}\n\n');
    const second = await reader.read();
    expect(decoder.decode(second.value)).toBe('data: {"type":"b"}\n\n');
    const third = await reader.read();
    expect(third.done).toBe(true);
  });

  it("found in review: keeps draining the generator to completion after the client disconnects, instead of killing it", async () => {
    // The real bug: toSseStream used to call events.return() on cancel,
    // which terminates the generator at its current yield -- any code
    // after the loop (the DB update marking the report done) never ran,
    // so a disconnected client left the report "running" forever.
    let reachedPostLoopCode = false;
    async function* events() {
      yield { type: "tool_call" };
      yield { type: "tool_call" };
      // Standing in for streamReport's post-loop DB update -- this must
      // still execute even though nobody's reading the stream anymore.
      reachedPostLoopCode = true;
      yield { type: "done" };
    }

    const stream = toSseStream(events());
    const reader = stream.getReader();
    await reader.read(); // one event delivered, then the client vanishes
    await reader.cancel();

    expect(afterCallback).toBeDefined();
    expect(reachedPostLoopCode).toBe(false); // not yet -- draining happens in the after() callback
    await afterCallback!();
    expect(reachedPostLoopCode).toBe(true);
  });

  it("draining after cancel doesn't throw even though nothing reads the remaining events", async () => {
    async function* events() {
      yield { type: "a" };
      yield { type: "b" };
      yield { type: "c" };
    }
    const reader = toSseStream(events()).getReader();
    await reader.cancel();
    await expect(afterCallback!()).resolves.toBeUndefined();
  });
});
