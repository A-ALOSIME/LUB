import {z} from "zod";
import {getAppOrigin} from "@/lib/env";
import {parseChatEvent, readChatStream} from "@/features/ai/chat-stream";

const question = z.object({message: z.string().trim().min(1).max(2000)});
const requestsByIp = new Map<string, {count: number; resetsAt: number}>();
const requestLimit = 10;
const windowMs = 60_000;

function responseError(error: string, status: number) {
  return Response.json({error}, {status, headers: {"Cache-Control": "no-store"}});
}

function hasValidOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  if (process.env.NODE_ENV !== "production" || process.env.LUB_LOCAL_PREVIEW === "1") {
    const url = new URL(request.url);
    if (["localhost", "127.0.0.1", "[::1]"].includes(url.hostname) && origin === url.origin) return true;
  }
  try {return origin === getAppOrigin();} catch {return false;}
}

function isRateLimited(request: Request) {
  const hostname = new URL(request.url).hostname;
  if ((process.env.NODE_ENV !== "production" || process.env.LUB_LOCAL_PREVIEW === "1") && ["localhost", "127.0.0.1", "[::1]"].includes(hostname)) return false;
  const now = Date.now();
  const key = request.headers.get("cf-connecting-ip");
  if (!key) return false;
  let entry = requestsByIp.get(key);
  if (!entry || entry.resetsAt <= now) entry = {count: 0, resetsAt: now + windowMs};
  entry.count++;
  requestsByIp.set(key, entry);
  if (requestsByIp.size > 5000) {
    for (const [ip, value] of requestsByIp) if (value.resetsAt <= now) requestsByIp.delete(ip);
    if (requestsByIp.size > 5000) requestsByIp.delete(requestsByIp.keys().next().value!);
  }
  return entry.count > requestLimit;
}

export async function POST(request: Request) {
  if (!hasValidOrigin(request)) return responseError("Forbidden", 403);
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) return responseError("Invalid request", 415);
  if (isRateLimited(request)) return responseError("Too many requests", 429);
  const reader = request.body?.getReader();
  if (!reader) return responseError("Invalid request", 400);
  const decoder = new TextDecoder();
  let text = "", size = 0;
  try {
    for (;;) {
      const {done, value} = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 12000) return responseError("Message too long", 413);
      text += decoder.decode(value, {stream: true});
    }
    text += decoder.decode();
  } catch {
    return responseError("Invalid request", 400);
  } finally {
    await reader.cancel().catch(() => undefined);
  }
  let body: unknown;
  try {body = JSON.parse(text);} catch {return responseError("Invalid request", 400);}
  const input = question.safeParse(body);
  if (!input.success) return responseError("Invalid question", 400);
  let url: URL;
  try {url = new URL(process.env.RAG_API_URL ?? "");}
  catch {
    console.warn("Ask LUB configuration unavailable", {reason: "url"});
    return responseError("المساعد غير متاح حاليًا. حاول مرة ثانية.", 503);
  }
  const token = process.env.RAG_API_TOKEN;
  if (url.protocol !== "https:" || url.username || url.password || url.pathname !== "/" || url.search || url.hash || !token || token.length < 32) {
    console.warn("Ask LUB configuration unavailable", {reason: !token || token.length < 32 ? "token" : "url"});
    return responseError("المساعد غير متاح حاليًا. حاول مرة ثانية.", 503);
  }
  const abort = new AbortController();
  let upstream: Response;
  try {
    upstream = await fetch(new URL("/api/v1/nlp/chat/stream/lub", url), {
      method: "POST", cache: "no-store", redirect: "manual",
      headers: {"Content-Type": "application/json", Authorization: `Bearer ${token}`, "ngrok-skip-browser-warning": "1"},
      body: JSON.stringify({...input.data, limit: 5}),
      signal: AbortSignal.any([abort.signal, request.signal, AbortSignal.timeout(120000)]),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown";
    console.warn("Ask LUB upstream request failed", {
      name: error instanceof Error ? error.name : "Unknown",
      message: message.replaceAll(token, "[REDACTED]").replaceAll(url.origin, "[RAG HOST]").slice(0, 200),
    });
    return responseError("المساعد غير متاح حاليًا. حاول مرة ثانية.", 503);
  }
  const contentType = upstream.headers.get("content-type")?.toLowerCase() ?? "";
  if (!upstream.ok || !upstream.body || !contentType.startsWith("text/event-stream")) {
    console.warn("Ask LUB upstream response rejected", {status: upstream.status, contentType});
    return responseError("المساعد غير متاح حاليًا. حاول مرة ثانية.", 503);
  }
  const encoder = new TextEncoder();
  let cancelled = false;
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: ReturnType<typeof parseChatEvent>) => {
        if (!cancelled) controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
      };
      try {await readChatStream(upstream.body!, send);}
      catch {send({type: "error", message: "المساعد غير متاح حاليًا. حاول مرة ثانية."});}
      finally {if (!cancelled) controller.close();}
    },
    cancel() {cancelled = true; abort.abort();},
  });
  return new Response(stream, {headers: {"Content-Type": "text/event-stream; charset=utf-8", "Cache-Control": "no-cache, no-transform", "X-Accel-Buffering": "no"}});
}
