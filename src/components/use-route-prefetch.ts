"use client";
import {useEffect,useRef} from "react";

/** Prefetch the finite visible categories once per page/locale, not every search permutation. */
export function useRoutePrefetch(prefetch:((href:string)=>void)|undefined,urls:()=>string[],scope:string){
 const sent=useRef("");
 useEffect(()=>{
  const key=`${scope}:${window.location.pathname}`;
  if(!prefetch||sent.current===key)return;
  sent.current=key;
  for(const href of new Set(urls()))if(href.startsWith("/")&&!href.startsWith("//"))prefetch(href);
 },[prefetch,urls,scope]);
}
