"use client";

import {t as translateUi} from "@/lib/i18n";
import {createContext,useContext,useEffect,useRef,useState,type ReactNode} from "react";
import {readChatStream,type ChatSource} from "./chat-stream";

export type ChatMessage = {id:number;role:"user"|"assistant";text:string;sources:ChatSource[]};
type FailedQuestion = {text:string;userId:number};

function useConversation(locale:"ar"|"en") {
  const [draft,setDraft]=useState("");
  const [messages,setMessages]=useState<ChatMessage[]>([]);
  const [busy,setBusy]=useState(false),[searching,setSearching]=useState(false),[error,setError]=useState("");
  const [failedQuestion,setFailedQuestion]=useState<FailedQuestion|null>(null),[conversation,setConversation]=useState(0);
  const request=useRef<AbortController|null>(null),sequence=useRef(0);
  useEffect(()=>()=>{request.current?.abort();request.current=null;},[]);

  function stop() {
    request.current?.abort();request.current=null;
    setBusy(false);setSearching(false);
    setMessages(previous=>previous.filter(message=>message.role==="user"||message.text));
  }
  function reset() {
    stop();setMessages([]);setDraft("");setError("");setFailedQuestion(null);setConversation(previous=>previous+1);
  }
  async function send(retry?:FailedQuestion) {
    const message=retry?.text??draft.trim();
    if(!message||busy||request.current)return;
    const userId=retry?.userId??++sequence.current,answerId=++sequence.current;
    setMessages(previous=>[...previous,...(!retry?[{id:userId,role:"user" as const,text:message,sources:[]}]:[]),{id:answerId,role:"assistant",text:"",sources:[]}]);
    if(!retry)setDraft("");
    setFailedQuestion(null);setBusy(true);setSearching(false);setError("");
    const abort=new AbortController();request.current=abort;
    let answer="",sources:ChatSource[]=[];
    try {
      const response=await fetch("/api/chat",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({message}),signal:AbortSignal.any([abort.signal,AbortSignal.timeout(125000)])});
      if(!response.ok||!response.body)throw new Error("Service unavailable");
      await readChatStream(response.body,event=>{
        if(request.current!==abort)return;
        if(event.type==="status")setSearching(event.status==="searching");
        if(event.type==="delta")answer+=event.text;
        if(event.type==="sources")sources=event.sources;
        setMessages(previous=>previous.map(item=>item.id===answerId?{...item,text:answer,sources}:item));
      });
    } catch {
      if(request.current!==abort)return;
      setMessages(previous=>previous.filter(item=>item.id!==answerId));setFailedQuestion({text:message,userId});
      setError(translateUi((locale==="en") ? "en" : "ar", "المساعد غير متاح حاليًا. سؤالك محفوظ؛ حاول مرة ثانية.", "The assistant is unavailable. Your question is saved; try again."));
    } finally {
      if(request.current===abort){setBusy(false);setSearching(false);request.current=null;}
    }
  }
  return {draft,setDraft,messages,busy,searching,error,failedQuestion,conversation,send,stop,reset};
}

export const ChatSessionContext=createContext<ReturnType<typeof useConversation>|null>(null);

// One provider in the root layout owns the request and conversation across routes.
// No messages are persisted on the server or in browser storage.
export function ChatSessionProvider({locale,children}:{locale:"ar"|"en";children:ReactNode}) {
  const session=useConversation(locale);
  return <ChatSessionContext value={session}>{children}</ChatSessionContext>;
}
export function useChatSession() {
  const session=useContext(ChatSessionContext);
  if(!session)throw new Error("ChatSessionProvider is required");
  return session;
}
