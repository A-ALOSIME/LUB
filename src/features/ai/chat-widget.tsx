"use client";

import {useContext, useEffect, useId, useRef, useState, type FormEvent, type ReactNode, type ComponentProps} from "react";
import Link from "next/link";
import Image from "next/image";
import {LubBrandName, LubSymbol} from "@/components/lub-brand-name";
import {usePathname} from "next/navigation";
import {ArrowDown, ArrowUp, Check, Copy, MessageCircle, Plus, Square, ThumbsDown, ThumbsUp, X, RotateCcw} from "lucide-react";
import {Alert,AlertDescription} from "@/components/ui/alert";
import {Button} from "@/components/ui/button";
import {Bubble, BubbleContent} from "@/components/ui/bubble";
import {Textarea} from "@/components/ui/textarea";
import {ScrollArea} from "@/components/ui/scroll-area";
import {Message, MessageAvatar, MessageContent, MessageFooter} from "@/components/ui/message";

import {Spinner} from "@/components/ui/spinner";
import {Tooltip, TooltipContent, TooltipProvider, TooltipTrigger} from "@/components/ui/tooltip";
import {cn} from "@/lib/utils";
import {ChatSessionContext,ChatSessionProvider,useChatSession,type ChatMessage} from "./chat-session";
import {Skeleton} from "@/components/ui/skeleton";


function ChatAction({label, children, ...props}: {label: string; children: ReactNode} & ComponentProps<typeof Button>) {
  return <Tooltip><TooltipTrigger render={<Button type="button" variant="ghost" size="icon-sm" aria-label={label} {...props}/>}>{children}</TooltipTrigger><TooltipContent>{label}</TooltipContent></Tooltip>;
}

function ChatLogo({className}: {className?:string}) {
  return <span className={cn("lub-chat-logo",className)} role="img" aria-label="لُبّ">
    <span className="lub-chat-logo-text">لُبّ</span>
    <Image src="/brand/logo.d904bc5ef68d.svg" alt="" width={315} height={150} className="brand-light"/>
    <Image src="/brand/logo-reversed.4c09d1c07d25.svg" alt="" width={315} height={150} className="brand-dark"/>
  </span>;
}

// The original text stays selectable/searchable; only its visual form uses the wordmark.
function brandText(text:string) {
  return text.split(/(لُبّ?|(?<![\p{L}\p{M}])لبّ?(?![\p{L}\p{M}]))/u).map((part,index)=>/^لُ?بّ?$/u.test(part)
    ? <LubBrandName key={index} text={part}/>
    : part);
}

function AssistantAvatar({inline}:{inline:boolean}) {
  return <MessageAvatar align={inline?"start":"end"} className="lub-chat-avatar" aria-hidden="true"><LubSymbol className="size-8"/></MessageAvatar>;
}

type ChatWidgetProps={locale:"ar"|"en";inline?:boolean;initiallyOpen?:boolean;embedded?:boolean};
export function ChatWidget(props:ChatWidgetProps) {
 const session=useContext(ChatSessionContext);
 return session?<ChatView {...props}/>:<ChatSessionProvider locale={props.locale}><ChatView {...props}/></ChatSessionProvider>;
}
function ChatView({locale,inline=false,initiallyOpen=false,embedded=false}:ChatWidgetProps) {
  const pathname = usePathname(), id = useId(), en = locale === "en";
  const panelId = "lub-chat-panel-" + id, titleId = "lub-chat-title-" + id, inputId = "lub-chat-question-" + id;
  const [open,setOpen]=useState(inline||initiallyOpen);
  const {draft,setDraft,messages,busy,searching,error,failedQuestion,conversation,send:sendMessage,stop,reset}=useChatSession();
  const [feedback, setFeedback] = useState<Record<number, "up" | "down" | undefined>>({});
  const [copyStatus, setCopyStatus] = useState<{messageId: number; status: "copied" | "failed"} | null>(null);
  const input = useRef<HTMLTextAreaElement>(null), launcher = useRef<HTMLButtonElement>(null);
  const started = messages.length > 0;
  const viewport=useRef<HTMLDivElement>(null), follow=useRef(true);
  const [scrolledUp,setScrolledUp]=useState(false);
  function scrollToLatest(){const element=viewport.current;if(element){element.scrollTop=element.scrollHeight;follow.current=true;setScrolledUp(false);}}
  useEffect(()=>{if(follow.current)scrollToLatest();},[messages,busy,error,conversation]);

  useEffect(() => {if (open && !inline) input.current?.focus();}, [open, inline]);
  useEffect(()=>{if(embedded)input.current?.focus();},[embedded]);

  function close() {setOpen(false); launcher.current?.focus();}
  function newConversation() {
    follow.current=true;reset();setCopyStatus(null);setFeedback({});input.current?.focus();
  }
  async function send(event?:FormEvent,retry?:{text:string;userId:number}) {
    event?.preventDefault();follow.current=true;setCopyStatus(null);await sendMessage(retry);
    if(inline&&!embedded)input.current?.focus();
  }
  async function copyAnswer(answer: ChatMessage) {
    try {await navigator.clipboard.writeText(answer.text); setCopyStatus({messageId: answer.id, status: "copied"});}
    catch {setCopyStatus({messageId: answer.id, status: "failed"});}
  }

  if (!inline && pathname === "/ai") return null;
  return <TooltipProvider><div className={cn("lub-chat", inline && "lub-chat-inline",embedded&&"lub-chat-embedded")} dir={en ? "ltr" : "rtl"}>
    {open && <section id={panelId} className={cn("lub-chat-panel", started && "has-messages")} role={inline ? "region" : "dialog"} aria-label={inline?(en?"Ask LUB":"اسأل لُبّ"):undefined} aria-labelledby={inline?undefined:titleId} onKeyDown={event => {if (!inline && event.key === "Escape") close();}}>
      {!embedded && (started || !inline) && <header className="lub-chat-header">
        {!inline && <h2 id={titleId}>{en ? "Ask LUB" : "اسأل لُب"}</h2>}
        <div className="lub-chat-header-actions">
          {started && <ChatAction label={en?"New chat":"محادثة جديدة"} onClick={newConversation}><Plus/></ChatAction>}
          {!inline && <ChatAction label={en ? "Close chat" : "إغلاق المحادثة"} onClick={close}><X/></ChatAction>}
        </div>
      </header>}
      <div className="lub-chat-thread">
        <ScrollArea className="lub-chat-messages" viewportRef={viewport} viewportProps={{"aria-busy":busy,onScroll:event=>{const element=event.currentTarget;const away=element.scrollHeight-element.scrollTop-element.clientHeight>64;follow.current=!away;setScrolledUp(away);}}}>
            <div className="lub-chat-thread-content">
              {!started && <div className="lub-chat-welcome">
                {embedded?<p>{en?"How can I help you?":"كيف أقدر أساعدك؟"}</p>:inline && <><ChatLogo className="lub-chat-welcome-logo"/><h1>{en ? "How can I help you?" : "كيف أقدر أساعدك؟"}</h1></>}
              </div>}
              {messages.map(message => <div key={message.id}>
                <Message align={message.role === "user" ? "end" : "start"} role="article" aria-label={message.role === "user" ? (en ? "Your question" : "سؤالك") : (en ? "Answer" : "الإجابة")} className={cn("lub-chat-message", "lub-chat-" + message.role)}>
                  {message.role === "assistant" && <AssistantAvatar inline={inline}/>}
                  <MessageContent>
                    <Bubble variant={message.role === "user" ? "default" : "secondary"} align={message.role === "user" ? "end" : "start"}>
                      <BubbleContent dir={en ? "ltr" : "rtl"}>{message.text?<p dir="auto">{brandText(message.text)}</p>:<div className="flex items-center gap-2 text-muted-foreground" role="status">{embedded?<><span aria-hidden="true" className="flex items-center gap-1"><Skeleton className="size-1.5 rounded-full"/><Skeleton className="size-1.5 rounded-full"/><Skeleton className="size-1.5 rounded-full"/></span><span className="sr-only">{en?"Thinking…":"يفكّر…"}</span></>:<><Spinner/>{searching?(en?"Searching…":"يبحث…"):(en?"Thinking…":"يفكّر…")}</>}</div>}
                        {message.sources.length > 0 && <div className="lub-chat-sources">{message.sources.map(source => <Link key={source.url} href={source.url} onClick={inline ? undefined : close}>{inline?brandText(source.label):source.label}</Link>)}</div>}
                      </BubbleContent>
                    </Bubble>
                    {message.role === "assistant" && !!message.text && <MessageFooter className="lub-chat-actions">
                      <ChatAction label={en ? "Copy answer" : "نسخ الإجابة"} onClick={() => void copyAnswer(message)}>{copyStatus?.messageId === message.id && copyStatus.status === "copied" ? <Check data-copied="true"/> : <Copy/>}</ChatAction>
                      <ChatAction label={en ? "Like answer" : "إعجاب بالإجابة"} aria-pressed={feedback[message.id] === "up"} onClick={() => setFeedback(previous => ({...previous, [message.id]: previous[message.id] === "up" ? undefined : "up"}))}><ThumbsUp/></ChatAction>
                      <ChatAction label={en ? "Dislike answer" : "عدم إعجاب بالإجابة"} aria-pressed={feedback[message.id] === "down"} onClick={() => setFeedback(previous => ({...previous, [message.id]: previous[message.id] === "down" ? undefined : "down"}))}><ThumbsDown/></ChatAction>
                      {copyStatus?.messageId === message.id && <span role="status" className="sr-only">{copyStatus.status === "copied" ? (en ? "Answer copied." : "نُسخت الإجابة.") : (en ? "Copy failed. Select and copy the answer." : "تعذّر النسخ. حدّد الإجابة وانسخها.")}</span>}
                    </MessageFooter>}
                  </MessageContent>
                </Message>
              </div>)}

              {error && <div><Message align="start" className="lub-chat-message lub-chat-assistant"><AssistantAvatar inline={inline}/><MessageContent><Alert variant="destructive" className="lub-chat-error" dir={en?"ltr":"rtl"}><AlertDescription>{error}</AlertDescription><Button type="button" variant="outline" size="sm" disabled={busy||!failedQuestion} onClick={()=>void send(undefined,failedQuestion??undefined)}><RotateCcw data-icon="inline-start"/>{en?"Retry":"إعادة المحاولة"}</Button></Alert></MessageContent></Message></div>}
            </div>
        </ScrollArea>
        {scrolledUp&&<Button type="button" variant="outline" size="icon" className="lub-chat-scroll-latest" aria-label={en?"Scroll to latest message":"نزّل لآخر المحادثة"} onClick={scrollToLatest}><ArrowDown/></Button>}
      </div>
      <footer className="lub-chat-composer">
        <form onSubmit={event => void send(event)}>
          <label className="sr-only" htmlFor={inputId}>{inline?(en?"Your question":"سؤالك"):en ? "Your question about LUB" : "سؤالك عن لُبّ"}</label>
          <div className="lub-chat-form">
            <Textarea ref={input} id={inputId} rows={1} maxLength={2000} value={draft} onChange={event => setDraft(event.target.value)} placeholder={inline?(en?"Type your question here...":"اكتب سؤالك هنا..."):en ? "Ask about LUB…" : "اكتب سؤالك عن لُبّ…"} onKeyDown={event => {if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {event.preventDefault(); void send();}}}/>
            <Button type={busy ? "button" : "submit"} size="icon" variant={busy || draft.trim() ? "default" : "secondary"} aria-label={busy ? (en ? "Stop response" : "إيقاف الرد") : (en ? "Send question" : "إرسال السؤال")} disabled={!busy && !draft.trim()} onClick={busy ? stop : undefined}>{busy ? <Square/> : <ArrowUp/>}</Button>
          </div>
        </form>
        <p className="lub-chat-disclaimer">{inline?(en?"The assistant can make mistakes. Check important information.":"قد يخطئ المساعد، تأكد من المعلومات المهمة"):en ? "LUB can make mistakes. Check important information." : "لُب قد يخطئ، تأكد من المعلومات المهمة"}</p>
      </footer>
    </section>}
    {!inline && <Button ref={launcher} className="lub-chat-launcher" type="button" aria-expanded={open} aria-controls={panelId} aria-label={en ? "Open LUB assistant" : "فتح مساعد لُبّ"} onClick={() => open ? close() : setOpen(true)}><MessageCircle/>{en ? "Ask LUB" : "اسأل لُبّ"}</Button>}
  </div></TooltipProvider>;
}
