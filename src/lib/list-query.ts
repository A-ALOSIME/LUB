"use client";
import {useSyncExternalStore,useMemo} from "react";
const eventName="list-query-change";
function subscribe(notify:()=>void){window.addEventListener("popstate",notify);window.addEventListener(eventName,notify);return()=>{window.removeEventListener("popstate",notify);window.removeEventListener(eventName,notify);};}
export function useListQuery(initialSearch=""){
 const search=useSyncExternalStore(subscribe,()=>window.location.search,()=>initialSearch);
 const params=useMemo(()=>new URLSearchParams(search),[search]);
 return {params,change:(values:Record<string,string|null>,replace=false)=>{const url=new URL(window.location.href);for(const[key,value]of Object.entries(values)){if(value===null||value===""||value==="all"||value==="0")url.searchParams.delete(key);else url.searchParams.set(key,value);}window.history[replace?"replaceState":"pushState"](window.history.state,"",url);window.dispatchEvent(new Event(eventName));}};
}
