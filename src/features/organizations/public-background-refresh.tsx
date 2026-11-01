"use client";
import {useEffect,useTransition} from "react";
import {useRouter} from "next/navigation";
/** Refresh mounted panels quietly; switching tabs continues to reuse their state. */
export function PublicBackgroundRefresh(){const router=useRouter(),[,startTransition]=useTransition();useEffect(()=>{let last=Date.now();const refresh=()=>{if(document.visibilityState==='visible'&&Date.now()-last>=120000){last=Date.now();startTransition(()=>router.refresh());}};const timer=setInterval(refresh,120000);window.addEventListener('focus',refresh);return()=>{clearInterval(timer);window.removeEventListener('focus',refresh);};},[router]);return null;}
