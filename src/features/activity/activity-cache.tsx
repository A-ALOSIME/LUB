"use client";
import {createContext,useCallback,useContext,useEffect,useRef,useState,type ReactNode} from "react";
import {privateJson} from "@/lib/private-query";

import type {ActivitySnapshot} from "./activity-data";
type ActivityCache={data:ActivitySnapshot|null;error:boolean;ensure:()=>Promise<void>;refresh:()=>Promise<void>;cancel:()=>void};
const Context=createContext<ActivityCache|null>(null);
export function ActivityCacheProvider({actorId,children}:{actorId:string|null;children:ReactNode}){
 return <ActivityCacheState key={actorId??"visitor"} actorId={actorId}>{children}</ActivityCacheState>;
}
function ActivityCacheState({actorId,children}:{actorId:string|null;children:ReactNode}){
 const [data,setData]=useState<ActivitySnapshot|null>(null),[error,setError]=useState(false);
 const checkedAt=useRef(0),controller=useRef<AbortController|null>(null);
 const current=useRef<ActivitySnapshot|null>(null),flight=useRef<Promise<void>|null>(null),mounted=useRef(true);
 const active=useRef(false),gc=useRef<ReturnType<typeof setTimeout>|null>(null);
 const cancel=useCallback(()=>{active.current=false;controller.current?.abort();if(gc.current)clearTimeout(gc.current);gc.current=setTimeout(()=>{current.current=null;if(mounted.current){setData(null);setError(false);}},600000);},[]);
 useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;controller.current?.abort();if(gc.current)clearTimeout(gc.current);};},[]);
 const refresh=useCallback(async()=>{
  if(!actorId)return;if(flight.current&&!controller.current?.signal.aborted)return flight.current;
  const pendingController=new AbortController();controller.current=pendingController;
  const request=privateJson<ActivitySnapshot>("/api/activity",pendingController.signal).then(next=>{if(next.actorId!==actorId)throw new Error("Activity identity changed");if(mounted.current&&!pendingController.signal.aborted){current.current=next;checkedAt.current=Date.now();setData(next);setError(false);}}).catch(()=>{if(mounted.current&&!pendingController.signal.aborted)setError(true);}).finally(()=>{if(flight.current===request)flight.current=null;});
  flight.current=request;return request;
 },[actorId]);
 const check=useCallback(async()=>{if(!current.current)return refresh();if(Date.now()-checkedAt.current<90000)return;checkedAt.current=Date.now();try{const {version}=await privateJson<{version:string}>("/api/activity?version=1",(controller.current=new AbortController()).signal);if(mounted.current&&version!==current.current?.version)await refresh();}catch{/* Preserve the last authorized view during transient failures. */}},[refresh]);
 const ensure=useCallback(async()=>{active.current=true;if(gc.current)clearTimeout(gc.current);if(current.current){void check();return;}await refresh();},[check,refresh]);
 useEffect(()=>{
  if(!data)return;let last=0,pending=false;
  const inspect=async()=>{if(!active.current||pending||document.visibilityState==="hidden"||navigator.onLine===false||Date.now()-last<90000)return;last=Date.now();pending=true;try{await check();}finally{pending=false;}};
  const changed=()=>{void refresh();};const timer=setInterval(()=>void inspect(),30000);
  window.addEventListener("focus",inspect);document.addEventListener("visibilitychange",inspect);window.addEventListener("activity-changed",changed);
  return()=>{clearInterval(timer);window.removeEventListener("focus",inspect);document.removeEventListener("visibilitychange",inspect);window.removeEventListener("activity-changed",changed);};
 },[data,check,refresh]);
 return <Context.Provider value={{data,error,ensure,refresh,cancel}}>{children}</Context.Provider>;
}
export function useActivityCache(){const value=useContext(Context);if(!value)throw new Error("ActivityCacheProvider required");return value;}
