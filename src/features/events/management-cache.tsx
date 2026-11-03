"use client";
import {createContext,useCallback,useContext,useEffect,useRef,useState,type ReactNode} from "react";

import {privateJson} from "@/lib/private-query";
export type OrganizationEventsSnapshot=Awaited<ReturnType<typeof import("./management-cache-actions").loadOrganizationEvents>>;
type Entry={data:OrganizationEventsSnapshot|null;error:boolean};
type Store={entries:Record<string,Entry>;ensure:(org:string)=>Promise<void>;refresh:(org:string)=>Promise<void>;check:(org:string)=>Promise<void>;cancel:(org:string)=>void};
const Context=createContext<Store|null>(null);
export function OrganizationEventsCacheProvider({actorId,children}:{actorId:string|null;children:ReactNode}){return <CacheState key={actorId??"visitor"} actorId={actorId}>{children}</CacheState>;}
function CacheState({actorId,children}:{actorId:string|null;children:ReactNode}){
 const [entries,setEntries]=useState<Record<string,Entry>>({}),current=useRef<Record<string,Entry>>({}),flights=useRef(new Map<string,Promise<void>>()),checked=useRef(new Map<string,number>()),mounted=useRef(true);
 useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;};},[]);
 const controllers=useRef(new Map<string,AbortController>());
 const gc=useRef(new Map<string,ReturnType<typeof setTimeout>>());
 const cancel=useCallback((org:string)=>{controllers.current.get(org)?.abort();clearTimeout(gc.current.get(org));gc.current.set(org,setTimeout(()=>{const next={...current.current};delete next[org];current.current=next;checked.current.delete(org);gc.current.delete(org);controllers.current.delete(org);if(mounted.current)setEntries(next);},600000));},[]);
 useEffect(()=>{const timers=gc.current,requests=controllers.current;return()=>{for(const timer of timers.values())clearTimeout(timer);for(const request of requests.values())request.abort();};},[]);
 const commit=useCallback((org:string,entry:Entry)=>{if(!mounted.current)return;current.current={...current.current,[org]:entry};setEntries(current.current);},[]);
 const refresh=useCallback(async(org:string)=>{
  if(!actorId)return;if(flights.current.has(org)&&!controllers.current.get(org)?.signal.aborted)return flights.current.get(org);
  const controller=new AbortController();controllers.current.set(org,controller);
  const request=privateJson<OrganizationEventsSnapshot>(`/api/organizations/${org}/event-lists`,controller.signal).then(next=>{if(next.actorId!==actorId||next.organization!==org)throw new Error("Organization cache identity changed");if(controller.signal.aborted)return;checked.current.set(org,Date.now());commit(org,{data:next,error:false});}).catch(()=>{if(!controller.signal.aborted)commit(org,{data:current.current[org]?.data??null,error:true});}).finally(()=>{if(flights.current.get(org)===request)flights.current.delete(org);});
  flights.current.set(org,request);return request;
 },[actorId,commit]);
 const check=useCallback(async(org:string)=>{if(!current.current[org]?.data)return refresh(org);if(Date.now()-(checked.current.get(org)??0)<90000)return;checked.current.set(org,Date.now());try{const {version}=await privateJson<{version:string|null}>(`/api/organizations/${org}/event-lists?version=1`,(()=>{const controller=new AbortController();controllers.current.set(org,controller);return controller.signal;})());if(!mounted.current)return;if(!version)commit(org,{data:null,error:true});else if(version!==current.current[org]?.data?.version)await refresh(org);}catch{/* Keep the loaded view during transient failures. */}},[refresh,commit]);
 const ensure=useCallback(async(org:string)=>{clearTimeout(gc.current.get(org));gc.current.delete(org);if(current.current[org]?.data){void check(org);return;}await refresh(org);},[check,refresh]);
 useEffect(()=>{const changed=(event:Event)=>{const org=(event as CustomEvent<{organization?:string}>).detail?.organization;for(const key of Object.keys(current.current))if(!org||org===key)void refresh(key);};window.addEventListener("organization-events-changed",changed);return()=>window.removeEventListener("organization-events-changed",changed);},[refresh]);
 return <Context.Provider value={{entries,ensure,refresh,check,cancel}}>{children}</Context.Provider>;
}
export function useOrganizationEventsCache(){const value=useContext(Context);if(!value)throw new Error("OrganizationEventsCacheProvider required");return value;}
