"use client";
import {useId,useState,type ReactNode} from "react";
import {Search} from "lucide-react";
import {Button} from "@/components/ui/button";
import {Tooltip,TooltipTrigger,TooltipContent} from "@/components/ui/tooltip";
import {useI18n} from "@/components/i18n-provider";
import {cn} from "@/lib/utils";
/** Shared layout only: each caller retains its own filtering, URL and form behavior. */
export function SearchFilterToolbar({search,children,className}:{search?:ReactNode;children:ReactNode;className?:string}){
 const [open,setOpen]=useState(false),id=useId(),{t}=useI18n();
 return <div className={cn("search-filter-toolbar",className)}>{search&&<><Tooltip><TooltipTrigger render={<Button className="search-filter-toggle" type="button" variant="outline" size="icon" aria-label={t("بحث","Search")} aria-expanded={open} aria-controls={id} onClick={()=>setOpen(!open)}/> }><Search/></TooltipTrigger><TooltipContent>{t("بحث","Search")}</TooltipContent></Tooltip><div id={id} data-open={open} className="search-filter-search">{search}</div></>}<div className="search-filter-controls">{children}</div></div>;
}
