"use client";

import {useEffect, useId, useRef, useState, type FormEvent, type ReactNode, type ComponentProps} from "react";
import Link from "next/link";
import {usePathname} from "next/navigation";
import {ArrowDown, ArrowUp, Check, Copy, MessageCircle, Plus, Square, ThumbsDown, ThumbsUp, X, RotateCcw} from "lucide-react";
import {Alert,AlertDescription} from "@/components/ui/alert";
import {Button} from "@/components/ui/button";
import {Bubble, BubbleContent} from "@/components/ui/bubble";
import {InputGroup, InputGroupAddon, InputGroupButton, InputGroupTextarea} from "@/components/ui/input-group";
import {Message, MessageAvatar, MessageContent, MessageFooter} from "@/components/ui/message";
import {MessageScroller, MessageScrollerButton, MessageScrollerContent, MessageScrollerItem, MessageScrollerProvider, MessageScrollerViewport} from "@/components/ui/message-scroller";
import {Spinner} from "@/components/ui/spinner";
import {Tooltip, TooltipContent, TooltipProvider, TooltipTrigger} from "@/components/ui/tooltip";
import {cn} from "@/lib/utils";
import {readChatStream, type ChatSource} from "./chat-stream";

type ChatMessage = {id: number; role: "user" | "assistant"; text: string; sources: ChatSource[]};

function ChatAction({label, children, ...props}: {label: string; children: ReactNode} & ComponentProps<typeof Button>) {
  return <Tooltip><TooltipTrigger render={<Button type="button" variant="ghost" size="icon-sm" aria-label={label} {...props}/>}>{children}</TooltipTrigger><TooltipContent>{label}</TooltipContent></Tooltip>;
}

export function ChatWidget({locale, inline = false, initiallyOpen = false}: {locale: "ar" | "en"; inline?: boolean; initiallyOpen?: boolean}) {
  const pathname = usePathname(), id = useId(), en = locale === "en";
  const panelId = "lub-chat-panel-" + id, titleId = "lub-chat-title-" + id, inputId = "lub-chat-question-" + id;
  const [open, setOpen] = useState(inline || initiallyOpen), [draft, setDraft] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]), [busy, setBusy] = useState(false);
  const [searching, setSearching] = useState(false), [error, setError] = useState("");
  const [failedQuestion,setFailedQuestion]=useState<{text:string;userId:number}|null>(null);
  const [conversation, setConversation] = useState(0);
  const [feedback, setFeedback] = useState<Record<number, "up" | "down" | undefined>>({});
  const [copyStatus, setCopyStatus] = useState<{messageId: number; status: "copied" | "failed"} | null>(null);
  const input = useRef<HTMLTextAreaElement>(null), launcher = useRef<HTMLButtonElement>(null);
  const request = useRef<AbortController | null>(null), sequence = useRef(0);
  const started = messages.length > 0;

  useEffect(() => {if (open && !inline) input.current?.focus();}, [open, inline]);
  useEffect(() => () => {request.current?.abort(); request.current = null;}, []);

  function close() {setOpen(false); launcher.current?.focus();}
  function stop() {
    request.current?.abort(); request.current = null;
    setBusy(false); setSearching(false);
    setMessages(previous => previous.filter(message => message.role === "user" || message.text));
  }
  function newConversation() {
    stop(); setMessages([]); setDraft(""); setError(""); setCopyStatus(null); setFeedback({}); setFailedQuestion(null);
    setConversation(previous => previous + 1); input.current?.focus();
  }
  async function send(event?: FormEvent,retry?:{text:string;userId:number}) {
    event?.preventDefault();
    const message = retry?.text ?? draft.trim();
    if (!message || busy || request.current) return;
    const userId = retry?.userId ?? ++sequence.current, answerId = ++sequence.current;
    setMessages(previous => [...previous, ...(!retry ? [{id: userId, role: "user" as const, text: message, sources: []}] : []), {id: answerId, role: "assistant", text: "", sources: []}]);
    if(!retry)setDraft(""); setFailedQuestion(null); setBusy(true); setSearching(false); setCopyStatus(null); setError("");
    const abort = new AbortController(); request.current = abort;
    let answer = "", sources: ChatSource[] = [];
    try {
      const response = await fetch("/api/chat", {method: "POST", headers: {"Content-Type": "application/json"}, body: JSON.stringify({message}), signal: AbortSignal.any([abort.signal, AbortSignal.timeout(125000)])});
      if (!response.ok || !response.body) throw new Error("Service unavailable");
      await readChatStream(response.body, event => {
        if (request.current !== abort) return;
        if (event.type === "status") setSearching(event.status === "searching");
        if (event.type === "delta") answer += event.text;
        if (event.type === "sources") sources = event.sources;
        setMessages(previous => previous.map(item => item.id === answerId ? {...item, text: answer, sources} : item));
      });
    } catch {
      if (request.current !== abort) return;
      setMessages(previous => previous.filter(item => item.id !== answerId));
      setFailedQuestion({text:message,userId});
      setError(en ? "The assistant is unavailable. Your question is saved; try again." : "المساعد غير متاح حاليًا. سؤالك محفوظ؛ حاول مرة ثانية.");
    } finally {
      if (request.current === abort) {
        setBusy(false); setSearching(false); request.current = null;
        if (inline) input.current?.focus();
      }
    }
  }
  async function copyAnswer(answer: ChatMessage) {
    try {await navigator.clipboard.writeText(answer.text); setCopyStatus({messageId: answer.id, status: "copied"});}
    catch {setCopyStatus({messageId: answer.id, status: "failed"});}
  }

  if (!inline && pathname === "/ai") return null;
  return <TooltipProvider><div className={cn("lub-chat", inline && "lub-chat-inline")} dir={en ? "ltr" : "rtl"}>
    {open && <section id={panelId} className={cn("lub-chat-panel", started && "has-messages")} role={inline ? "region" : "dialog"} aria-labelledby={titleId} onKeyDown={event => {if (!inline && event.key === "Escape") close();}}>
      {(started || !inline) && <header className="lub-chat-header">
        {inline ? <h1 id={titleId}>{en ? "Ask LUB" : "اسأل لُب"}</h1> : <h2 id={titleId}>{en ? "Ask LUB" : "اسأل لُب"}</h2>}
        <div className="lub-chat-header-actions">
          {started && <Button type="button" variant="ghost" size="sm" onClick={newConversation}><Plus data-icon="inline-start"/>{en ? "New chat" : "محادثة جديدة"}</Button>}
          {!inline && <ChatAction label={en ? "Close chat" : "إغلاق المحادثة"} onClick={close}><X/></ChatAction>}
        </div>
      </header>}
      <MessageScrollerProvider key={conversation} autoScroll>
        <MessageScroller className="lub-chat-thread">
          <MessageScrollerViewport className="lub-chat-messages" aria-busy={busy}>
            <MessageScrollerContent className="lub-chat-thread-content">
              {!started && <MessageScrollerItem messageId="welcome" className="lub-chat-welcome">
                {inline ? <h1 id={titleId}>{en ? "Ask LUB" : "اسأل لُب"}</h1> : null}
              </MessageScrollerItem>}
              {messages.map(message => message.text && <MessageScrollerItem key={message.id} messageId={String(message.id)}>
                <Message align={message.role === "user" ? "end" : "start"} role="article" aria-label={message.role === "user" ? (en ? "Your question" : "سؤالك") : (en ? "Answer" : "الإجابة")} className={cn("lub-chat-message", "lub-chat-" + message.role)}>
                  {message.role === "assistant" && <MessageAvatar className="lub-chat-avatar"><span className="lub-chat-symbol" aria-hidden="true"/></MessageAvatar>}
                  <MessageContent>
                    <Bubble variant={message.role === "user" ? "default" : "secondary"} align={message.role === "user" ? "end" : "start"}>
                      <BubbleContent dir={en ? "ltr" : "rtl"}><p dir="auto">{message.text}</p>
                        {message.sources.length > 0 && <div className="lub-chat-sources">{message.sources.map(source => <Link key={source.url} href={source.url} onClick={inline ? undefined : close}>{source.label}</Link>)}</div>}
                      </BubbleContent>
                    </Bubble>
                    {message.role === "assistant" && <MessageFooter className="lub-chat-actions">
                      <ChatAction label={en ? "Copy answer" : "نسخ الإجابة"} onClick={() => void copyAnswer(message)}>{copyStatus?.messageId === message.id && copyStatus.status === "copied" ? <Check data-copied="true"/> : <Copy/>}</ChatAction>
                      <ChatAction label={en ? "Like answer" : "إعجاب بالإجابة"} aria-pressed={feedback[message.id] === "up"} onClick={() => setFeedback(previous => ({...previous, [message.id]: previous[message.id] === "up" ? undefined : "up"}))}><ThumbsUp/></ChatAction>
                      <ChatAction label={en ? "Dislike answer" : "عدم إعجاب بالإجابة"} aria-pressed={feedback[message.id] === "down"} onClick={() => setFeedback(previous => ({...previous, [message.id]: previous[message.id] === "down" ? undefined : "down"}))}><ThumbsDown/></ChatAction>
                      {copyStatus?.messageId === message.id && <span role="status" className="sr-only">{copyStatus.status === "copied" ? (en ? "Answer copied." : "نُسخت الإجابة.") : (en ? "Copy failed. Select and copy the answer." : "تعذّر النسخ. حدّد الإجابة وانسخها.")}</span>}
                    </MessageFooter>}
                  </MessageContent>
                </Message>
              </MessageScrollerItem>)}
              {busy && <MessageScrollerItem messageId="thinking"><div className="lub-chat-thinking" role="status"><Spinner aria-hidden="true"/>{searching ? (en ? "Searching LUB…" : "أبحث في لُب…") : (en ? "Thinking…" : "لُب يفكّر…")}</div></MessageScrollerItem>}
              {error && <MessageScrollerItem messageId="error"><Message align="start" className="lub-chat-message lub-chat-assistant"><MessageAvatar className="lub-chat-avatar"><span className="lub-chat-symbol" aria-hidden="true"/></MessageAvatar><MessageContent><Alert variant="destructive" className="lub-chat-error" dir={en?"ltr":"rtl"}><AlertDescription>{error}</AlertDescription><Button type="button" variant="outline" size="sm" disabled={busy||!failedQuestion} onClick={()=>void send(undefined,failedQuestion??undefined)}><RotateCcw data-icon="inline-start"/>{en?"Retry":"إعادة المحاولة"}</Button></Alert></MessageContent></Message></MessageScrollerItem>}
            </MessageScrollerContent>
          </MessageScrollerViewport>
          <MessageScrollerButton aria-label={en ? "Scroll to latest message" : "نزّل لآخر المحادثة"}><ArrowDown/></MessageScrollerButton>
        </MessageScroller>
      </MessageScrollerProvider>
      <footer className="lub-chat-composer">
        <form onSubmit={event => void send(event)}>
          <label className="sr-only" htmlFor={inputId}>{en ? "Your question about LUB" : "سؤالك عن لُبّ"}</label>
          <InputGroup className="lub-chat-form">
            <InputGroupTextarea ref={input} id={inputId} rows={1} maxLength={2000} value={draft} onChange={event => setDraft(event.target.value)} placeholder={en ? "Ask about LUB…" : "اكتب سؤالك عن لُبّ…"} onKeyDown={event => {if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {event.preventDefault(); void send();}}}/>
            <InputGroupAddon align="inline-end"><InputGroupButton type={busy ? "button" : "submit"} size="icon-sm" variant={busy || draft.trim() ? "default" : "secondary"} aria-label={busy ? (en ? "Stop response" : "إيقاف الرد") : (en ? "Send question" : "إرسال السؤال")} disabled={!busy && !draft.trim()} onClick={busy ? stop : undefined}>{busy ? <Square/> : <ArrowUp/>}</InputGroupButton></InputGroupAddon>
          </InputGroup>
        </form>
        <p className="lub-chat-disclaimer">{en ? "LUB can make mistakes. Check important information." : "لُب قد يخطئ، تأكد من المعلومات المهمة"}</p>
      </footer>
    </section>}
    {!inline && <Button ref={launcher} className="lub-chat-launcher" type="button" aria-expanded={open} aria-controls={panelId} aria-label={en ? "Open LUB assistant" : "فتح مساعد لُبّ"} onClick={() => open ? close() : setOpen(true)}><MessageCircle/>{en ? "Ask LUB" : "اسأل لُبّ"}</Button>}
  </div></TooltipProvider>;
}
