"use client";
import {useState,type ReactNode} from "react";
import {Ellipsis} from "lucide-react";
import {Button} from "@/components/ui/button";
import {DropdownMenu,DropdownMenuTrigger,DropdownMenuContent,DropdownMenuGroup,DropdownMenuItem} from "@/components/ui/dropdown-menu";
import {ManagementActionSheet} from "@/components/management-action-sheet";
import type {Locale} from "@/lib/preferences";
export function EventSecondaryTools({actions,locale}:{actions:Array<{id:string;label:string;content:ReactNode}>;locale:Locale}){
 const [selected,setSelected]=useState<string|null>(null);
 return <><DropdownMenu><DropdownMenuTrigger render={<Button variant="outline" aria-label={locale==="en"?"More event tools":"أدوات الفعالية الأخرى"} size="icon"><Ellipsis/></Button>}/><DropdownMenuContent align="start"><DropdownMenuGroup>{actions.map(action=><DropdownMenuItem key={action.id} onClick={()=>setSelected(action.id)}>{action.label}</DropdownMenuItem>)}</DropdownMenuGroup></DropdownMenuContent></DropdownMenu>{actions.map(action=><ManagementActionSheet key={action.id} label="" title={action.label} locale={locale} open={selected===action.id} onOpenChange={open=>{if(!open)setSelected(null);}} hideTrigger mobileBottomSheet>{action.content}</ManagementActionSheet>)}</>;
}
