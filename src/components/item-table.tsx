"use client";

import {useRouter} from "next/navigation";
import type {ReactNode} from "react";
import {Table,TableHeader,TableBody,TableRow,TableHead,TableCell} from "@/components/ui/table";
import {Card,CardHeader,CardContent} from "@/components/ui/card";
import {Tooltip,TooltipTrigger,TooltipContent} from "@/components/ui/tooltip";
import {cn} from "@/lib/utils";

export type ItemTableColumn<T>={id:string;label:ReactNode;render:(item:T)=>ReactNode;className?:string};
export function ItemTitle({children}:{children:ReactNode}){
 return <Tooltip><TooltipTrigger render={<span className="block min-w-0 truncate py-0.5 font-medium"/>}>{children}</TooltipTrigger><TooltipContent className="max-w-sm whitespace-normal break-words">{children}</TooltipContent></Tooltip>;
}
/** Item lists only. People tables keep their existing columns and never receive thumbnails. */
type ItemTableProps<T extends {id:string}>={items:T[];columns:ItemTableColumn<T>[];onOpen?:(item:T)=>void;href?:(item:T)=>string;onPrefetch?:(item:T)=>void;empty?:ReactNode;label:string};
export function ItemTable<T extends {id:string}>(props:ItemTableProps<T>){return props.href?<LinkedItemTable {...props}/>:<ItemTableBody {...props}/>;}
function LinkedItemTable<T extends {id:string}>(props:ItemTableProps<T>){const router=useRouter();return <ItemTableBody {...props} onOpen={item=>{if(props.onOpen)props.onOpen(item);else if(props.href)router.push(props.href(item));}}/>;}
function ItemTableBody<T extends {id:string}>({items,columns,onOpen,onPrefetch,empty,label}:ItemTableProps<T>){
 const open=(item:T)=>onOpen?.(item);
 const props=(item:T)=>({tabIndex:0,"aria-label":label,onClick:(event:React.MouseEvent)=>{if(!(event.target instanceof Element)||!event.target.closest("button,a,input,select,textarea,[role=button],[role=checkbox]"))open(item);},onKeyDown:(event:React.KeyboardEvent)=>{if(event.key==="Enter"&&event.target===event.currentTarget){event.preventDefault();open(item);}},onMouseEnter:()=>onPrefetch?.(item),onFocus:()=>onPrefetch?.(item),onTouchStart:()=>onPrefetch?.(item)});
 if(!items.length)return empty;
 return <div className="@container min-w-0"><div className="hidden min-w-0 @min-[48rem]:block"><Table className="table-fixed [&_.row-action]:size-8 [&_.row-action]:min-h-8"><TableHeader><TableRow>{columns.map(col=><TableHead key={col.id} className={cn("whitespace-normal",col.className)}>{col.label}</TableHead>)}</TableRow></TableHeader><TableBody>{items.map(item=><TableRow key={item.id} {...props(item)} className="cursor-pointer focus-visible:outline-2 focus-visible:outline-ring">{columns.map(col=><TableCell key={col.id} className={cn("whitespace-normal",col.className)} {...(col.id==="actions"?{onClick:(event:React.MouseEvent)=>event.stopPropagation(),onKeyDown:(event:React.KeyboardEvent)=>event.stopPropagation()}:{} )}>{col.render(item)}</TableCell>)}</TableRow>)}</TableBody></Table></div><ul className="flex min-w-0 flex-col gap-3 @min-[48rem]:hidden">{items.map(item=><li key={item.id}><Card {...props(item)} className="cursor-pointer gap-3 py-4 transition-colors hover:bg-muted/50 focus-visible:outline-2 focus-visible:outline-ring"><CardHeader>{columns[0].render(item)}</CardHeader><CardContent className="flex min-w-0 flex-col gap-3">{columns.slice(1).map(col=><div key={col.id} {...(col.id==="actions"?{onClick:(event:React.MouseEvent)=>event.stopPropagation(),onKeyDown:(event:React.KeyboardEvent)=>event.stopPropagation()}:{} )}>{col.id!=="actions"&&<span className="sr-only">{col.label}</span>}{col.render(item)}</div>)}</CardContent></Card></li>)}</ul></div>;
}
