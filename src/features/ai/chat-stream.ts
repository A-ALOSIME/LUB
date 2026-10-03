export type ChatSource = {label: string; url: string};
export type ChatEvent =
  | {type: "status"; status: string}
  | {type: "delta"; text: string}
  | {type: "sources"; sources: ChatSource[]}
  | {type: "done"}
  | {type: "error"; message: string};

export function publicChatPath(value: string): string | null {
  if (/[\\\s\u0000-\u001f]/u.test(value)) return null;
  try {
    const url = new URL(value, "https://lub.invalid");
    if ((url.origin !== "https://lub.invalid" && url.origin !== "https://lub.community") || url.username || url.password || url.pathname === "/events/mine") return null;
    if (!/^\/(?:$|events(?:\/[\w-]+)?$|organizations(?:\/[\w-]+)?$|talent(?:\/[\w-]+)?$|help\/[\w-]+$)/u.test(url.pathname)) return null;
    return url.pathname + url.search + url.hash;
  } catch {
    return null;
  }
}

export function parseChatEvent(payload: string): ChatEvent {
  const data: unknown = JSON.parse(payload);
  if (!data || typeof data !== "object" || !("type" in data)) throw new Error("Invalid stream event");
  if (data.type === "done") return {type: "done"};
  if (data.type === "error") return {type: "error", message: "المساعد غير متاح حاليًا. حاول مرة ثانية."};
  if (data.type === "status" && "status" in data && typeof data.status === "string") return {type: "status", status: data.status};
  if (data.type === "delta" && "text" in data && typeof data.text === "string" && data.text.length <= 16000) return {type: "delta", text: data.text};
  if (data.type === "sources" && "sources" in data && Array.isArray(data.sources) && data.sources.length <= 3) {
    const sources: ChatSource[] = [];
    for (const source of data.sources) {
      if (!source || typeof source !== "object" || !("label" in source) || !("url" in source) || typeof source.label !== "string" || typeof source.url !== "string") throw new Error("Invalid source");
      const url = publicChatPath(source.url);
      if (url && source.label.length <= 200) sources.push({label: source.label, url});
    }
    return {type: "sources", sources};
  }
  throw new Error("Invalid stream event");
}

export async function readChatStream(body: ReadableStream<Uint8Array>, onEvent: (event: ChatEvent) => void) {
  const reader = body.getReader(), decoder = new TextDecoder();
  let pending = "", bytes = 0, finished = false;
  try {
    while (!finished) {
      const {done, value} = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > 128000) throw new Error("Stream too large");
      pending += decoder.decode(value, {stream: true});
      let boundary: RegExpExecArray | null;
      const delimiter = /\r?\n\r?\n/g;
      while ((boundary = delimiter.exec(pending))) {
        const frame = pending.slice(0, boundary.index);
        pending = pending.slice(boundary.index + boundary[0].length);
        delimiter.lastIndex = 0;
        const payload = frame.split(/\r?\n/u).filter(line => line.startsWith("data: ")).map(line => line.slice(6)).join("\n");
        if (!payload) continue;
        const event = parseChatEvent(payload);
        onEvent(event);
        if (event.type === "error") throw new Error("Service unavailable");
        if (event.type === "done") {finished = true; break;}
      }
    }
    if (!finished) throw new Error("Interrupted stream");
  } finally {
    await reader.cancel().catch(() => undefined);
  }
}
