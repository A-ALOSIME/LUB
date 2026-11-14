"use client";
import type Link from "next/link";
import {IntentPrefetchLink} from "@/features/organizations/intent-prefetch-link";
import {useSyncExternalStore,type ComponentProps} from "react";
import {withReturnTo} from "@/lib/return-navigation";

const events=["popstate","hashchange","list-query-change","activity-tab-change","organization-section-change"];
function subscribe(update:()=>void){
 for(const event of events)window.addEventListener(event,update);
 return ()=>{for(const event of events)window.removeEventListener(event,update);};
}
export function useOriginHref(){
 const origin=useSyncExternalStore(subscribe,()=>window.location.pathname+window.location.search+window.location.hash,()=>"");
 return (href:string)=>withReturnTo(href,origin);
}
export function OriginLink({href,...props}:Omit<ComponentProps<typeof Link>,"href"|"prefetch">&{href:string}){
 const from=useOriginHref();
 return <IntentPrefetchLink href={from(href)} {...props}/>;
}
