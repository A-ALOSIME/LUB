"use client";
import type {ReactNode} from "react";
import {Card,CardContent} from "@/components/ui/card";
import type {Locale} from "@/lib/preferences";
/** Bulk actions stay in the content flow near the selected table, never at the screen edge. */
export function SelectionActionBar({visible,message,actions,locale}:{visible:boolean;message?:ReactNode;actions?:ReactNode;locale:Locale;formId?:string;pending?:boolean;onUndo?:()=>void}){
 if(!visible)return null;
 return <Card className="selection-action-bar sticky top-20 z-20 py-3"><CardContent dir={locale==="ar"?"rtl":"ltr"} className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3 px-4"><span className="text-sm font-medium" role="status">{message}</span><div className="flex flex-nowrap items-center justify-center gap-3">{actions}</div></CardContent></Card>;
}
