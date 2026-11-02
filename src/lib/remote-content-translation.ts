"use client";
import {useCallback,useEffect,useSyncExternalStore} from "react";

type Entry={value?:string;pending?:Promise<void>;retryAt:number;listeners:Set<()=>void>};
const cache=new Map<string,Entry>();
const queue:Array<()=>void>=[];let active=0;
function entryFor(source:string){
 let entry=cache.get(source);if(entry)return entry;
 if(cache.size>=1000)for(const [key,value] of cache)if(!value.pending&&!value.listeners.size){cache.delete(key);break;}
 entry={retryAt:0,listeners:new Set()};cache.set(source,entry);return entry;
}
function pump(){while(active<3&&queue.length){active++;queue.shift()!();}}
async function requestTranslation(source:string,entry:Entry){
 if(entry.value!==undefined||entry.pending||entry.retryAt>Date.now())return;
 entry.pending=new Promise<void>(resolve=>{queue.push(()=>{
  void(async()=>{try{
   for(let attempt=0;attempt<3;attempt++){
    const response=await fetch("/api/translations",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({text:source,target_lang:"EN"}),signal:AbortSignal.timeout(35000)});
    if(response.status===202){await new Promise(done=>setTimeout(done,1500));continue;}
    if(!response.ok)throw Error("Translation unavailable");
    const body:unknown=await response.json();
    if(!body||typeof body!=="object"||!("translated_text" in body)||typeof body.translated_text!=="string"||!body.translated_text.trim())throw Error("Invalid translation");
    entry.value=body.translated_text;return;
   }
   throw Error("Translation pending");
  }catch{entry.retryAt=Date.now()+30000;}
  finally{entry.pending=undefined;for(const listener of entry.listeners)listener();active--;resolve();pump();}})();
 });});pump();await entry.pending;
}
/** Opt-in public content only; failures always retain the exact source text. */
export function useRemoteContentTranslation(source:string,enabled:boolean){
 const eligible=enabled&&source.length<=10000&&/[\u0621-\u064a]/u.test(source);
 const subscribe=useCallback((listener:()=>void)=>{if(!eligible)return()=>{};const entry=entryFor(source);entry.listeners.add(listener);return()=>{entry.listeners.delete(listener);};},[source,eligible]);
 const snapshot=useCallback(()=>eligible?cache.get(source)?.value:undefined,[source,eligible]);
 const translated=useSyncExternalStore(subscribe,snapshot,()=>undefined);
 useEffect(()=>{if(eligible)void requestTranslation(source,entryFor(source));},[source,eligible]);
 return translated??source;
}
