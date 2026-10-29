"use client";

import {useEffect,useRef,useTransition,type FormEvent,type FormHTMLAttributes,type ReactNode} from "react";
import {useRouter} from "next/navigation";

/** GET filters keep the current layout; server actions and POST forms retain native behavior. */
export function LiveFilterForm({children,className="",debounceMs=250,action,method}:{children:ReactNode;className?:string;debounceMs?:number;action?:FormHTMLAttributes<HTMLFormElement>["action"];method?:"get"|"post"}){
 const router=useRouter(),[pending,startTransition]=useTransition();
 const timer=useRef<ReturnType<typeof setTimeout>|null>(null);
 useEffect(()=>()=>{if(timer.current)clearTimeout(timer.current);},[]);
 function submit(event:FormEvent<HTMLFormElement>){
  const form=event.currentTarget;
  if(typeof action==="function"||form.method.toLowerCase()!=="get"||form.target&&form.target!=="_self")return;
  const button=(event.nativeEvent as SubmitEvent).submitter as HTMLButtonElement|null;
  if(button?.formMethod&&button.formMethod!=="get"||button?.formTarget&&button.formTarget!=="_self")return;
  const url=new URL(button?.hasAttribute("formaction")?button.formAction:form.action,window.location.href);if(url.origin!==window.location.origin)return;
  const data=new FormData(form,button??undefined);const params=new URLSearchParams();
  for(const [key,value] of data){if(typeof value!=="string")return;params.append(key,value);}
  url.search=params.toString();event.preventDefault();
  const href=url.pathname+url.search+url.hash;if(href===window.location.pathname+window.location.search+window.location.hash)return;
  startTransition(()=>router.replace(href,{scroll:false}));
 }
 function change(event:FormEvent<HTMLFormElement>){const form=event.currentTarget,target=event.target;if(!(target instanceof HTMLInputElement||target instanceof HTMLSelectElement))return;if(timer.current)clearTimeout(timer.current);if(target instanceof HTMLInputElement&&["text","search"].includes(target.type)){timer.current=setTimeout(()=>form.requestSubmit(),debounceMs);return;}form.requestSubmit();}
 return <form action={action} method={typeof action==="function"?undefined:method??"get"} onSubmit={submit} onChange={change} aria-busy={pending||undefined} className={className}>{children}</form>;
}
