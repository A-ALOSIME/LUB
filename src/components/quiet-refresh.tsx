"use client";
import {useEffect,useRef,useTransition} from "react";
import {useRouter} from "next/navigation";

/** Retain mounted content; refresh its data only when an authenticated fingerprint changes. */
export function QuietRefresh({version,readVersion}:{version:string;readVersion:()=>Promise<string>}){
 const router=useRouter(),current=useRef(version),[,startTransition]=useTransition();
 useEffect(()=>{current.current=version;},[version]);
 useEffect(()=>{
  let cancelled=false,pending=false,lastCheck=0;
  async function check(){
   if(cancelled||pending||document.visibilityState==="hidden"||navigator.onLine===false||Date.now()-lastCheck<5000)return;
   pending=true;lastCheck=Date.now();
   try{const next=await readVersion();if(!cancelled&&next&&next!==current.current){current.current=next;startTransition(()=>router.refresh());}}
   catch{/* Keep the last successful view during temporary connection failures. Server actions still authorize writes. */}
   finally{pending=false;}
  }
  const timer=window.setInterval(()=>void check(),30000);
  window.addEventListener("focus",check);document.addEventListener("visibilitychange",check);
  return()=>{cancelled=true;window.clearInterval(timer);window.removeEventListener("focus",check);document.removeEventListener("visibilitychange",check);};
 },[readVersion,router,startTransition]);
 return null;
}
