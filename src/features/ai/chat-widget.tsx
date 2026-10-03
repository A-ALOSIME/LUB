"use client";

import {useEffect, useId, useRef, useState, type FormEvent} from "react";
import Link from "next/link";
import {usePathname} from "next/navigation";
import {readChatStream, type ChatSource} from "./chat-stream";

type Message = {id: number; role: "user" | "assistant"; text: string; sources: ChatSource[]};

export function ChatWidget({locale, inline = false}: {locale: "ar" | "en"; inline?: boolean}) {
  const pathname = usePathname(), id = useId();
  const panelId = "lub-chat-panel-" + id, titleId = "lub-chat-title-" + id, inputId = "lub-chat-question-" + id;
  const en = locale === "en";
  const [open, setOpen] = useState(inline), [draft, setDraft] = useState("");
  const [messages, setMessages] = useState<Message[]>([]), [busy, setBusy] = useState(false);
  const [searching, setSearching] = useState(false), [error, setError] = useState("");
  const [copyStatus, setCopyStatus] = useState<"copied" | "failed" | null>(null);
  const input = useRef<HTMLTextAreaElement>(null), launcher = useRef<HTMLButtonElement>(null);
  const end = useRef<HTMLDivElement>(null), request = useRef<AbortController | null>(null);
  const sequence = useRef(0);

  useEffect(() => {if (open && !inline) input.current?.focus();}, [open, inline]);
  useEffect(() => {end.current?.scrollIntoView({block: "nearest"});}, [messages, searching]);
  useEffect(() => () => request.current?.abort(), []);

  function close() {setOpen(false); launcher.current?.focus();}

  async function send(event?: FormEvent, suggestedQuestion?: string) {
    event?.preventDefault();
    const message = (suggestedQuestion ?? draft).trim();
    if (!message || busy || request.current) return;
    const userId = ++sequence.current, answerId = ++sequence.current;
    setMessages(previous => [...previous, {id: userId, role: "user", text: message, sources: []}, {id: answerId, role: "assistant", text: "", sources: []}]);
    setDraft(""); setBusy(true); setSearching(false); setCopyStatus(null); setError("");
    const abort = new AbortController(); request.current = abort;
    let answer = "", sources: ChatSource[] = [];
    try {
      const response = await fetch("/api/chat", {method: "POST", headers: {"Content-Type": "application/json"}, body: JSON.stringify({message}), signal: AbortSignal.any([abort.signal, AbortSignal.timeout(125000)])});
      if (!response.ok || !response.body) throw new Error("Service unavailable");
      await readChatStream(response.body, event => {
        if (event.type === "status") setSearching(event.status === "searching");
        if (event.type === "delta") answer += event.text;
        if (event.type === "sources") sources = event.sources;
        setMessages(previous => previous.map(item => item.id === answerId ? {...item, text: answer, sources} : item));
      });
    } catch {
      setMessages(previous => previous.filter(item => item.id !== answerId));
      setDraft(message);
      setError(en ? "The assistant is unavailable. Your question is saved; try again." : "المساعد غير متاح حاليًا. سؤالك محفوظ؛ حاول مرة ثانية.");
    } finally {
      setBusy(false); setSearching(false); request.current = null;
      if (inline) input.current?.focus();
    }
  }

  async function copyAnswer() {
    const answer = [...messages].reverse().find(message => message.role === "assistant" && message.text);
    if (!answer) return;
    try {await navigator.clipboard.writeText(answer.text); setCopyStatus("copied");}
    catch {setCopyStatus("failed");}
  }

  if (!inline && pathname === "/ai") return null;
  const suggestions = en ? ["How do I join a club?", "How do I register for an event?"] : ["كيف أنضم لنادي؟", "كيف أسجل في فعالية؟"];
  return <div className={inline ? "lub-chat lub-chat-inline" : "lub-chat"} dir={en ? "ltr" : "rtl"}>
    {open && <section id={panelId} className="lub-chat-panel" role={inline ? "region" : "dialog"} aria-labelledby={titleId} onKeyDown={event => {if (!inline && event.key === "Escape") close();}}>
      {!inline && <header className="lub-chat-header"><span className="lub-chat-avatar" aria-hidden="true">لُبّ</span><div><h2 id={titleId}>{en ? "Ask LUB" : "اسأل لُبّ"}</h2><p>{en ? "Your guide to clubs and events" : "دليلك للأندية والفعاليات"}</p></div><button type="button" className="lub-chat-close" aria-label={en ? "Close chat" : "إغلاق المحادثة"} onClick={close}>×</button></header>}
      {inline && <h2 id={titleId} className="sr-only">{en ? "Ask LUB" : "اسأل لُبّ"}</h2>}
      <div className="lub-chat-messages" aria-busy={busy} aria-live="polite">
        {messages.length === 0 && <div className="lub-chat-welcome"><p>{en ? "Ask about LUB clubs, events and services." : "اسأل عن أندية لُبّ وفعالياته وخدماته."}</p>{!inline && <div className="lub-chat-suggestions">{suggestions.map(text => <button key={text} type="button" onClick={() => void send(undefined, text)}>{text}<span aria-hidden="true">↗</span></button>)}</div>}</div>}
        {messages.map(message => message.text && <article key={message.id} className={"lub-chat-message lub-chat-" + message.role}><span className="lub-chat-speaker">{message.role === "user" ? (en ? "You" : "أنت") : (en ? "LUB" : "لُبّ")}</span><p dir="auto">{message.text}</p>{message.sources.length > 0 && <div className="lub-chat-sources">{message.sources.map(source => <Link key={source.url} href={source.url} onClick={inline ? undefined : close}>{source.label}<span aria-hidden="true">↗</span></Link>)}</div>}</article>)}
        {busy && <p className="lub-chat-thinking" role="status"><span className="lub-chat-dots" aria-hidden="true"><i/><i/><i/></span>{searching ? (en ? "Looking through LUB…" : "لحظة، أبحث في لُبّ…") : (en ? "One moment…" : "لحظة…")}</p>}
        {error && <p className="error-message" role="alert">{error}</p>}
        <div ref={end}/>
      </div>
      <form className="lub-chat-form" onSubmit={event => void send(event)}><label className="sr-only" htmlFor={inputId}>{en ? "Your question about LUB" : "سؤالك عن لُبّ"}</label><textarea ref={input} id={inputId} rows={2} maxLength={2000} value={draft} onChange={event => setDraft(event.target.value)} placeholder={en ? "Ask about LUB…" : "اكتب سؤالك عن لُبّ…"} onKeyDown={event => {if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {event.preventDefault(); void send();}}}/><button type="submit" aria-label={en ? "Send question" : "إرسال السؤال"} disabled={busy || !draft.trim()}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="m12 19 0-14m-6 6 6-6 6 6"/></svg></button></form>
      {messages.some(message => message.role === "assistant" && message.text) && <button type="button" className="lub-chat-copy" onClick={copyAnswer}>{en ? "Copy answer" : "نسخ الإجابة"}</button>}
      {copyStatus && <p role="status" className="lub-chat-copy-status">{copyStatus === "copied" ? (en ? "Answer copied." : "نُسخت الإجابة.") : (en ? "Copy failed. Select and copy the answer." : "تعذّر النسخ. حدّد الإجابة وانسخها.")}</p>}
      <footer className="lub-chat-footer">{en ? "Public LUB content only. Do not include personal details." : "اسأل عن محتوى لُبّ العام فقط، ولا تكتب معلوماتك الشخصية."}</footer>
    </section>}
    {!inline && <button ref={launcher} className="lub-chat-launcher" type="button" aria-expanded={open} aria-controls={panelId} aria-label={en ? "Open LUB assistant" : "فتح مساعد لُبّ"} onClick={() => open ? close() : setOpen(true)}><svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><path d="M20 11.5a8 8 0 0 1-8 8H5l-4 3v-11a9 9 0 0 1 19 0Z"/><path d="M6 11h.01M11 11h.01M16 11h.01" strokeWidth="3" strokeLinecap="round"/></svg><span>{en ? "Ask LUB" : "اسأل لُبّ"}</span></button>}
  </div>;
}
