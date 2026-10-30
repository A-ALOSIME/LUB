"use client";
import {createContext,useCallback,useContext,useEffect,useRef,useState,type ReactNode} from "react";
import {loadActivitySnapshot} from "./activity-data-actions";
import {readActivityVersion} from "./freshness-actions";
import type {ActivitySnapshot} from "./activity-data";
type ActivityCache={data:ActivitySnapshot|null;error:boolean;ensure:()=>Promise<void>;refresh:()=>Promise<void>};
const Context=createContext<ActivityCache|null>(null);
export function ActivityCacheProvider({actorId,children}:{actorId:string|null;children:ReactNode}){
 return <ActivityCacheState key={actorId??"visitor"} actorId={actorId}>{children}</ActivityCacheState>;
}
function ActivityCacheState({actorId,children}:{actorId:string|null;children:ReactNode}){
 const [data,setData]=useState<ActivitySnapshot|null>(null),[error,setError]=useState(false);
 const checkedAt=useRef(0);
 const current=useRef<ActivitySnapshot|null>(null),flight=useRef<Promise<void>|null>(null),mounted=useRef(true);
 useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;};},[]);
 const refresh=useCallback(async()=>{
  if(!actorId)return;if(flight.current)return flight.current;
  const request=loadActivitySnapshot().then(next=>{if(next.actorId!==actorId)throw new Error("Activity identity changed");if(mounted.current){current.current=next;checkedAt.current=Date.now();setData(next);setError(false);}}).catch(()=>{if(mounted.current)setError(true);}).finally(()=>{flight.current=null;});
  flight.current=request;return request;
 },[actorId]);
 const check=useCallback(async()=>{if(!current.current)return refresh();if(Date.now()-checkedAt.current<5000)return;checkedAt.current=Date.now();try{const version=await readActivityVersion();if(mounted.current&&version!==current.current?.version)await refresh();}catch{/* Preserve the last authorized view during transient failures. */}},[refresh]);
 const ensure=useCallback(async()=>{if(current.current){void check();return;}await refresh();},[check,refresh]);
 useEffect(()=>{
  if(!data)return;let last=0,pending=false;
  const inspect=async()=>{if(pending||document.visibilityState==="hidden"||navigator.onLine===false||Date.now()-last<5000)return;last=Date.now();pending=true;try{await check();}finally{pending=false;}};
  const changed=()=>{void refresh();};const timer=setInterval(()=>void inspect(),30000);
  window.addEventListener("focus",inspect);document.addEventListener("visibilitychange",inspect);window.addEventListener("activity-changed",changed);
  return()=>{clearInterval(timer);window.removeEventListener("focus",inspect);document.removeEventListener("visibilitychange",inspect);window.removeEventListener("activity-changed",changed);};
 },[data,check,refresh]);
 return <Context.Provider value={{data,error,ensure,refresh}}>{children}</Context.Provider>;
}
export function useActivityCache(){const value=useContext(Context);if(!value)throw new Error("ActivityCacheProvider required");return value;}
