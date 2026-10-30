"use client";
import {createContext,useCallback,useContext,useEffect,useRef,useState,type ReactNode} from "react";
import {loadOrganizationEvents,readOrganizationEventsVersion} from "./management-cache-actions";
export type OrganizationEventsSnapshot=Awaited<ReturnType<typeof loadOrganizationEvents>>;
type Entry={data:OrganizationEventsSnapshot|null;error:boolean};
type Store={entries:Record<string,Entry>;ensure:(org:string)=>Promise<void>;refresh:(org:string)=>Promise<void>;check:(org:string)=>Promise<void>};
const Context=createContext<Store|null>(null);
export function OrganizationEventsCacheProvider({actorId,children}:{actorId:string|null;children:ReactNode}){return <CacheState key={actorId??"visitor"} actorId={actorId}>{children}</CacheState>;}
function CacheState({actorId,children}:{actorId:string|null;children:ReactNode}){
 const [entries,setEntries]=useState<Record<string,Entry>>({}),current=useRef<Record<string,Entry>>({}),flights=useRef(new Map<string,Promise<void>>()),checked=useRef(new Map<string,number>()),mounted=useRef(true);
 useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;};},[]);
 const commit=useCallback((org:string,entry:Entry)=>{if(!mounted.current)return;current.current={...current.current,[org]:entry};setEntries(current.current);},[]);
 const refresh=useCallback(async(org:string)=>{
  if(!actorId)return;if(flights.current.has(org))return flights.current.get(org);
  const request=loadOrganizationEvents(org).then(next=>{if(next.actorId!==actorId||next.organization!==org)throw new Error("Organization cache identity changed");checked.current.set(org,Date.now());commit(org,{data:next,error:false});}).catch(()=>commit(org,{data:current.current[org]?.data??null,error:true})).finally(()=>{flights.current.delete(org);});
  flights.current.set(org,request);return request;
 },[actorId,commit]);
 const check=useCallback(async(org:string)=>{if(!current.current[org]?.data)return refresh(org);if(Date.now()-(checked.current.get(org)??0)<5000)return;checked.current.set(org,Date.now());try{const version=await readOrganizationEventsVersion(org);if(!mounted.current)return;if(!version)commit(org,{data:null,error:true});else if(version!==current.current[org]?.data?.version)await refresh(org);}catch{/* Keep the loaded view during transient failures. */}},[refresh,commit]);
 const ensure=useCallback(async(org:string)=>{if(current.current[org]?.data){void check(org);return;}await refresh(org);},[check,refresh]);
 useEffect(()=>{const changed=(event:Event)=>{const org=(event as CustomEvent<{organization?:string}>).detail?.organization;for(const key of Object.keys(current.current))if(!org||org===key)void refresh(key);};window.addEventListener("organization-events-changed",changed);return()=>window.removeEventListener("organization-events-changed",changed);},[refresh]);
 return <Context.Provider value={{entries,ensure,refresh,check}}>{children}</Context.Provider>;
}
export function useOrganizationEventsCache(){const value=useContext(Context);if(!value)throw new Error("OrganizationEventsCacheProvider required");return value;}
