"use client";
import {t as translateUi} from "@/lib/i18n";
import {LubBrandName} from "./lub-brand-name";
import Link from "next/link";
import {useEffect,useRef} from "react";
import {usePathname} from "next/navigation";
export function SiteNavigation({en}:{en:boolean}) {
 const path=usePathname()??"", nav=useRef<HTMLElement>(null);
 useEffect(()=>{
  const element=nav.current;if(!element)return;
  const revealCurrent=()=>{
   const current=element.querySelector<HTMLElement>('[aria-current="page"]');if(!current)return;
   const link=current.getBoundingClientRect(),bounds=element.getBoundingClientRect();
   // Scroll only the horizontal navigation, keeping the page's own scroll position.
   if(link.left<bounds.left)element.scrollBy({left:link.left-bounds.left,behavior:"instant"});
   else if(link.right>bounds.right)element.scrollBy({left:link.right-bounds.right,behavior:"instant"});
  };
  revealCurrent();const observer=typeof ResizeObserver!=="undefined"?new ResizeObserver(revealCurrent):null;observer?.observe(element);
  return()=>observer?.disconnect();
 },[path]);
 const items=[{href:"/organizations",match:"/organizations",label:translateUi((en) ? "en" : "ar", "الأندية والمجالس", "Clubs and councils")},{href:"/events/discover",match:"/events",label:translateUi((en) ? "en" : "ar", "الفعاليات", "Events")},{href:"/talent",match:"/talent",label:translateUi((en) ? "en" : "ar", "المواهب", "Talent")},{href:"/ai",match:"/ai",label:translateUi((en) ? "en" : "ar", "اسأل لُبّ", "Ask LUB")}];
 return <nav ref={nav} dir={en?"ltr":"rtl"} aria-label={translateUi((en) ? "en" : "ar", "التنقل الرئيسي", "Main navigation")} className="site-nav site-header-nav">{items.map(item=><Link key={item.href} href={item.href} prefetch={item.href!=="/ai"} aria-current={path===item.match||path.startsWith(item.match+"/")?"page":undefined}><span className="site-nav-label">{item.href==="/ai"&&!en?<span className="site-nav-brand-label">اسأل <LubBrandName wordmark/></span>:item.label}</span><span className="site-nav-size-label" aria-hidden="true">{item.label}</span></Link>)}</nav>;
}
