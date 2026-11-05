"use client";
import {useEffect,useRef,useState} from "react";
import {AlertDialog,AlertDialogContent,AlertDialogHeader,AlertDialogTitle,AlertDialogDescription,AlertDialogFooter,AlertDialogAction,AlertDialogCancel} from "@/components/ui/alert-dialog";
import {navigationHistoryIndex} from "@/lib/navigation-history";
import {createTranslator} from "@/lib/i18n";
import type {Locale} from "@/lib/preferences";

export function UnsavedChangesGuard({dirty,locale}:{dirty:boolean;locale:Locale}){
 const [open,setOpen]=useState(false),departure=useRef<()=>void>(()=>{}),bypass=useRef(false),t=createTranslator(locale);
 useEffect(()=>{
  if(!dirty)return;
  const initialIndex=navigationHistoryIndex();let restoring=false,allowTraversal=false,steps=0;
  const unload=(event:BeforeUnloadEvent)=>{event.preventDefault();event.returnValue="";};
  const click=(event:MouseEvent)=>{
   if(bypass.current||event.defaultPrevented||event.button||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;
   const link=event.target instanceof Element?event.target.closest<HTMLAnchorElement>("a[href]"):null;
   if(!link||link.hasAttribute("download")||link.target&&link.target!=="_self"||link.href===window.location.href)return;
   event.preventDefault();event.stopPropagation();departure.current=()=>{bypass.current=true;link.click();bypass.current=false;};setOpen(true);
  };
  const section=(event:Event)=>{event.preventDefault();departure.current=(event as CustomEvent<()=>void>).detail;setOpen(true);};
  const history=(event:PopStateEvent)=>{
   if(allowTraversal){allowTraversal=false;return;}
   const next=navigationHistoryIndex();if(initialIndex===undefined||next===undefined)return;
   const direction=Math.sign(initialIndex-next);
   if(restoring){event.stopImmediatePropagation();if(!direction)restoring=false;else{steps++;window.history.go(direction);}return;}
   if(!direction)return;
   event.stopImmediatePropagation();steps=1;restoring=true;
   departure.current=()=>{allowTraversal=true;window.history.go(-direction*steps);};window.history.go(direction);setOpen(true);
  };
  window.addEventListener("beforeunload",unload);document.addEventListener("click",click,true);window.addEventListener("workspace-before-navigate",section);window.addEventListener("popstate",history,true);
  return()=>{window.removeEventListener("beforeunload",unload);document.removeEventListener("click",click,true);window.removeEventListener("workspace-before-navigate",section);window.removeEventListener("popstate",history,true);};
 },[dirty]);
 return <AlertDialog open={open&&dirty} onOpenChange={setOpen}><AlertDialogContent dir={locale==="ar"?"rtl":"ltr"}><AlertDialogHeader><AlertDialogTitle>{t("لديك تغييرات غير محفوظة","You have unsaved changes")}</AlertDialogTitle><AlertDialogDescription>{t("يمكنك البقاء لحفظها، أو المغادرة وتجاهل التغييرات.","Stay to save your work, or leave and discard these changes.")}</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogAction onClick={()=>{setOpen(false);departure.current();}}>{t("تجاهل ومغادرة","Discard and leave")}</AlertDialogAction><AlertDialogCancel>{t("البقاء في المحرر","Stay in editor")}</AlertDialogCancel></AlertDialogFooter></AlertDialogContent></AlertDialog>;
}
