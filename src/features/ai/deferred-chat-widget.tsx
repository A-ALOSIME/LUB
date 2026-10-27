"use client";
import {useState} from "react";
import Link from "next/link";
import {MessageCircle,ExternalLink,X} from "lucide-react";
import {Button} from "@/components/ui/button";
import {Popover,PopoverTrigger,PopoverContent,PopoverHeader,PopoverTitle} from "@/components/ui/popover";
import {Sheet,SheetTrigger,SheetContent,SheetHeader,SheetTitle} from "@/components/ui/sheet";
import {Tooltip,TooltipTrigger,TooltipContent} from "@/components/ui/tooltip";
import {LubBrandName,LubSymbol} from "@/components/lub-brand-name";
import {useIsMobile} from "@/hooks/use-mobile";
import {ChatWidget} from "./chat-widget";

export function DeferredChatWidget({locale}:{locale:"ar"|"en"}) {
  const [open,setOpen]=useState(false),mobile=useIsMobile(),en=locale==="en";
  const title=<><LubSymbol className="size-6 shrink-0"/>{en?"LUB":<LubBrandName/>}</>;
  const launcher=<Button className="floating-assistant-link rounded-full" aria-label={en?"Ask LUB":"اسأل لُبّ"}><MessageCircle/><span className="hidden sm:inline">{en?"Ask LUB":<>اسأل <LubBrandName/></>}</span></Button>;
  const actions=<div className="flex shrink-0 items-center gap-1">
    <Tooltip><TooltipTrigger render={<Button variant="ghost" size="icon-sm" nativeButton={false} role="link" render={<Link href="/ai" onClick={()=>setOpen(false)}/>} aria-label={en?"Open full page":"افتح في صفحة كاملة"}/>}><ExternalLink/></TooltipTrigger><TooltipContent>{en?"Open full page":"افتح في صفحة كاملة"}</TooltipContent></Tooltip>
    <Tooltip><TooltipTrigger render={<Button variant="ghost" size="icon-sm" aria-label={en?"Close chat":"إغلاق المحادثة"} onClick={()=>setOpen(false)}/>}><X/></TooltipTrigger><TooltipContent>{en?"Close chat":"إغلاق المحادثة"}</TooltipContent></Tooltip>
  </div>;
  const body=<div className="min-h-0 flex-1"><ChatWidget locale={locale} inline embedded/></div>;
  if(mobile)return <Sheet open={open} onOpenChange={setOpen}>
    <SheetTrigger render={launcher}/>
    <SheetContent side="bottom" dir={en?"ltr":"rtl"} className="h-dvh max-h-dvh w-full gap-0 rounded-none p-0" showCloseButton={false}>
      <SheetHeader className="flex-row items-center gap-2 border-b border-border p-3"><SheetTitle className="flex flex-1 items-center gap-2">{title}</SheetTitle>{actions}</SheetHeader>{body}
    </SheetContent>
  </Sheet>;
  return <Popover open={open} onOpenChange={(next,details)=>{
    // A page link must remain usable without dismissing the conversation.
    if(!next&&(details.reason==="outside-press"||details.reason==="focus-out")){details.cancel();return;}
    setOpen(next);
  }}>
    <PopoverTrigger render={launcher}/>
    <PopoverContent side="top" align={en?"start":"end"} sideOffset={12} collisionPadding={12} dir={en?"ltr":"rtl"} className="flex h-[520px] max-h-[calc(100dvh-100px)] w-[380px] max-w-[calc(100vw-24px)] flex-col gap-0 overflow-hidden p-0">
      <PopoverHeader className="flex-row items-center gap-2 border-b border-border p-3"><PopoverTitle className="flex flex-1 items-center gap-2">{title}</PopoverTitle>{actions}</PopoverHeader>{body}
    </PopoverContent>
  </Popover>;
}
