// Minimal server-sent-events reader for a fetch() response body. Not
// EventSource, because EventSource can't send the POST + JSON body
// /api/reports needs — this reads the same "data: ...\n\n" wire format
// by hand from the stream fetch() already gives us.
export async function readSse(response: Response, onEvent: (data: unknown) => void): Promise<void> {
  const reader = response.body?.getReader();
  if (!reader) return;

  const decoder = new TextDecoder();
  let buffer = "";

  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    let separator = buffer.indexOf("\n\n");
    while (separator !== -1) {
      const message = buffer.slice(0, separator);
      buffer = buffer.slice(separator + 2);
      if (message.startsWith("data: ")) {
        onEvent(JSON.parse(message.slice("data: ".length)));
      }
      separator = buffer.indexOf("\n\n");
    }
  }
}
