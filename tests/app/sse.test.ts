import { describe, expect, it } from "vitest";
import { readSse } from "@/app/_components/sse";

function responseFromChunks(chunks: string[]): Response {
  const encoder = new TextEncoder();
  let i = 0;
  const stream = new ReadableStream<Uint8Array>({
    pull(controller) {
      if (i < chunks.length) {
        controller.enqueue(encoder.encode(chunks[i++]));
      } else {
        controller.close();
      }
    },
  });
  return new Response(stream);
}

describe("readSse", () => {
  it("parses multiple events delivered in one chunk", async () => {
    const events: unknown[] = [];
    await readSse(responseFromChunks(['data: {"type":"a"}\n\ndata: {"type":"b"}\n\n']), (e) => events.push(e));
    expect(events).toEqual([{ type: "a" }, { type: "b" }]);
  });

  it("parses one event split across multiple chunks", async () => {
    const events: unknown[] = [];
    await readSse(responseFromChunks(['data: {"ty', 'pe":"a"}', "\n\n"]), (e) => events.push(e));
    expect(events).toEqual([{ type: "a" }]);
  });

  it("ignores a trailing partial event with no terminator", async () => {
    const events: unknown[] = [];
    await readSse(responseFromChunks(['data: {"type":"a"}\n\ndata: {"incomplete"']), (e) => events.push(e));
    expect(events).toEqual([{ type: "a" }]);
  });

  it("does nothing for a response with no body", async () => {
    const events: unknown[] = [];
    await readSse(new Response(null), (e) => events.push(e));
    expect(events).toEqual([]);
  });
});
