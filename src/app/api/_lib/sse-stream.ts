import { after } from "next/server";

// Shared by both report-creation routes (api/reports, api/admin/reports).
//
// Found in review: cancel() used to call events.return(), which forces
// the generator to terminate at its current yield -- any code after the
// agent loop (the DB update that marks the report succeeded/failed, the
// refund) never ran. A disconnected client (closed tab, refresh, network
// blip) left the report "running" forever: credits held, a second
// attempt blocked with already_running for 5 minutes, and the tokens
// already spent never recorded. plan.md's own Risks table claimed "the
// page recovers by polling" -- it couldn't, because the run never
// actually finished.
//
// Fix: never force-stop the generator. On cancel, keep calling
// events.next() to completion so the run's own try/catch and DB update
// still execute -- via after(), which keeps this function alive past
// the point the response itself has ended. The yielded progress events
// are discarded (nothing is reading the stream anymore); only reaching
// a real "done" -- succeeded, failed, or the generator's own caught
// error -- matters here.
export function toSseStream<T>(events: AsyncGenerator<T, void>): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream({
    async pull(controller) {
      const { value, done } = await events.next();
      if (done) {
        controller.close();
        return;
      }
      controller.enqueue(encoder.encode(`data: ${JSON.stringify(value)}\n\n`));
    },
    cancel() {
      after(async () => {
        let next = await events.next();
        while (!next.done) {
          next = await events.next();
        }
      });
    },
  });
}
