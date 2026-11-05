"use client";

import {useState,isValidElement,type ReactNode,type MouseEvent,type KeyboardEvent} from "react";
import {useRouter} from "next/navigation";
import {Table,TableHeader,TableBody,TableRow,TableHead,TableCell} from "@/components/ui/table";
import {Card,CardHeader,CardContent} from "@/components/ui/card";
import {Checkbox} from "@/components/ui/checkbox";
import {Button} from "@/components/ui/button";
import {Tooltip,TooltipTrigger,TooltipContent} from "@/components/ui/tooltip";
import {useI18n} from "@/components/i18n-provider";
import {useListQuery} from "@/lib/list-query";
import {createTranslator} from "@/lib/i18n";
import type {Locale} from "@/lib/preferences";
import {cn} from "@/lib/utils";

export type DataTableColumn<T>={id:string;label:ReactNode;render:(item:T)=>ReactNode;renderMobile?:(item:T)=>ReactNode;className?:string;optional?:boolean;sortKey?:string;sortValue?:(item:T)=>string|number};
export type DataTableSelection<T>={selected?:ReadonlySet<string>;onChange?:(ids:Set<string>)=>void;disabled?:(item:T)=>boolean;reason?:(item:T)=>string|undefined};
export type DataTablePagination={page:number;more:boolean;onChange:(page:number)=>void};
type Props<T extends {id:string}>={items:T[];columns:DataTableColumn<T>[];canOpen?:(item:T)=>boolean;onOpen?:(item:T)=>void;href?:(item:T)=>string;onPrefetch?:(item:T)=>void;empty?:ReactNode;label:string;tableKey?:string;selection?:false|DataTableSelection<T>;pagination?:DataTablePagination;sort?:{value:string;onChange:(value:string)=>void};showColumnsControl?:boolean;locale?:Locale;footer?:ReactNode;summary?:ReactNode;emptyAsRow?:boolean};
export function DataTableTitle({children}:{children:ReactNode}){return <Tooltip><TooltipTrigger render={<span className="block min-w-0 truncate py-0.5 font-medium"/>}>{children}</TooltipTrigger><TooltipContent className="max-w-sm whitespace-normal break-words">{children}</TooltipContent></Tooltip>;}

/** The same URL-backed visibility control can live in a page's existing toolbar. */
function textValue(node:ReactNode):string{if(node===null||node===undefined||typeof node==="boolean")return "";if(typeof node==="string"||typeof node==="number")return String(node);if(Array.isArray(node))return node.map(textValue).join(" ");if(isValidElement<{children?:ReactNode;value?:string}>(node))return node.props.value??textValue(node.props.children);return "";}
export function DataTable<T extends {id:string}>(props:Props<T>){return props.href?<LinkedDataTable {...props}/>:<DataTableBody {...props}/>;}
function LinkedDataTable<T extends {id:string}>(props:Props<T>){const router=useRouter();return <DataTableBody {...props} onOpen={item=>{if(props.onOpen)props.onOpen(item);else if(props.href)router.push(props.href(item));}}/>;}
function DataTableBody<T extends {id:string}>({items,columns,onOpen,canOpen,onPrefetch,empty,label,tableKey="table",selection,pagination,sort,showColumnsControl=true,locale,footer,summary,emptyAsRow=false}:Props<T>){
 const {t:defaultT}=useI18n(),t=locale?createTranslator(locale):defaultT,{params,change}=useListQuery(),[localSelected,setLocalSelected]=useState<Set<string>>(()=>new Set());
 const model=selection||undefined,selected=model?.selected??localSelected;
 const eligible=items.filter(item=>!model?.disabled?.(item)),checked=eligible.filter(item=>selected.has(item.id)),all=eligible.length>0&&checked.length===eligible.length;
 const visible=columns,localSort=params.get(`${tableKey}Sort`),sortColumn=columns.find(column=>column.id===localSort?.split(":")[0]);
 const ordered=sortColumn?[...items].sort((a,b)=>{const value=(row:T)=>{if(sortColumn.sortValue)return sortColumn.sortValue(row);const record=row as Record<string,unknown>;if(["date","joined","period"].includes(sortColumn.id)){for(const field of ["created_at","createdAt","submitted_at","starts_at","startDate","joinedAt","opens","publishedAt"]){const raw=record[field];if(typeof raw==="string"&&!Number.isNaN(Date.parse(raw)))return Date.parse(raw);}}return textValue(sortColumn.render(row));};const av=value(a),bv=value(b);return (typeof av==="number"&&typeof bv==="number"?av-bv:String(av).localeCompare(String(bv),locale,{numeric:true}))*(localSort?.endsWith(":desc")?-1:1);}):items;
 void pagination;void showColumnsControl;
 function sortBy(column:DataTableColumn<T>){if(column.sortKey&&sort)sort.onChange(sort.value===`${column.sortKey}:asc`?`${column.sortKey}:desc`:`${column.sortKey}:asc`);else change({[`${tableKey}Sort`]:`${column.id}:${localSort===`${column.id}:asc`?"desc":"asc"}`},true);}

 function select(ids:Set<string>){if(model?.onChange)model.onChange(ids);else setLocalSelected(ids);}
 function toggle(item:T,value:boolean){const next=new Set(selected);if(value)next.add(item.id);else next.delete(item.id);select(next);}
 function togglePage(value:boolean){const next=new Set(selected);for(const item of eligible)if(value)next.add(item.id);else next.delete(item.id);select(next);}
 const rowProps=(item:T)=>({tabIndex:onOpen&&(!canOpen||canOpen(item))?0:undefined,"aria-label":onOpen&&(!canOpen||canOpen(item))?label:undefined,"data-state":selected.has(item.id)?"selected":undefined,onClick:(event:MouseEvent)=>{if(!(event.target instanceof Element)||!event.target.closest("button,a,input,select,textarea,label,[role=button],[role=checkbox],[data-no-row-open]"))if(!canOpen||canOpen(item))onOpen?.(item);},onKeyDown:(event:KeyboardEvent)=>{if(event.key==="Enter"&&event.target===event.currentTarget&&(!canOpen||canOpen(item))){event.preventDefault();onOpen?.(item);}},onMouseEnter:()=>onPrefetch?.(item),onFocus:()=>onPrefetch?.(item),onTouchStart:()=>onPrefetch?.(item)});
 function selectionBox(item:T,index:number){const disabled=Boolean(model?.disabled?.(item)),reason=disabled?model?.reason?.(item):undefined;const box=<Checkbox aria-label={t(`تحديد الصف ${index+1}`,`Select row ${index+1}`)} checked={selected.has(item.id)} disabled={disabled} onCheckedChange={value=>toggle(item,value)}/>;return <span data-no-row-open onClick={event=>event.stopPropagation()} onKeyDown={event=>event.stopPropagation()}>{reason?<Tooltip><TooltipTrigger render={<span className="inline-flex" tabIndex={0}/>}>{box}</TooltipTrigger><TooltipContent>{reason}</TooltipContent></Tooltip>:box}</span>;}
 const cell=(column:DataTableColumn<T>,item:T,mobile=false)=>column.id==="actions"?<div data-slot="data-table-actions" className="flex flex-nowrap items-center gap-1" onClick={event=>event.stopPropagation()} onKeyDown={event=>event.stopPropagation()}>{mobile&&column.renderMobile?column.renderMobile(item):column.render(item)}</div>:column.render(item);
 if(!items.length&&!pagination&&!emptyAsRow)return empty;
 return <div data-slot="data-table" className="@container flex min-w-0 flex-col gap-3 bg-background">
  {summary&&<p className="text-sm text-muted-foreground">{summary}</p>}
  {items.length>0||emptyAsRow?<><div className="hidden min-w-0 @min-[64rem]:block"><Table aria-label={label} className="table-fixed [&_.row-action]:size-8 [&_.row-action]:min-h-8"><TableHeader><TableRow className="hover:bg-transparent">{model&&<TableHead className="w-10"><Checkbox aria-label={t("تحديد الكل","Select all")} checked={all} indeterminate={checked.length>0&&!all} disabled={!eligible.length} onCheckedChange={togglePage}/></TableHead>}{visible.map(column=><TableHead key={column.id} className={cn("whitespace-normal text-muted-foreground",column.className)}>{column.id!=="actions"&&!isValidElement(column.label)?<Button type="button" variant="ghost" className="h-auto min-h-0 gap-1 p-0 text-start font-medium text-muted-foreground" onClick={()=>sortBy(column)}>{column.label}</Button>:column.label}</TableHead>)}</TableRow></TableHeader><TableBody>{ordered.map((item,index)=><TableRow key={item.id} {...rowProps(item)} className={cn("h-16 focus-visible:outline-2 focus-visible:outline-ring",onOpen&&(!canOpen||canOpen(item))&&"cursor-pointer")}>{model&&<TableCell className="w-10">{selectionBox(item,index)}</TableCell>}{visible.map(column=><TableCell key={column.id} className={cn("whitespace-normal py-2",column.className)}>{cell(column,item)}</TableCell>)}</TableRow>)}{!ordered.length&&<TableRow><TableCell colSpan={visible.length+(model?1:0)} className="py-8 text-center">{empty}</TableCell></TableRow>}</TableBody></Table></div>
  <ul className="flex min-w-0 flex-col gap-3 @min-[64rem]:hidden">{ordered.map((item,index)=><li key={item.id}><Card variant="outline" {...rowProps(item)} className={cn("gap-3 py-4 transition-colors hover:bg-muted/50 focus-visible:outline-2 focus-visible:outline-ring",onOpen&&(!canOpen||canOpen(item))&&"cursor-pointer")}><CardHeader className="flex min-w-0 flex-row items-start gap-3">{model&&selectionBox(item,index)}<div className="min-w-0 flex-1">{visible[0].render(item)}</div></CardHeader><CardContent className="flex min-w-0 flex-col gap-3">{visible.slice(1).map(column=><div key={column.id}>{column.id!=="actions"&&<span className="sr-only">{column.label}</span>}{cell(column,item,true)}</div>)}</CardContent></Card></li>)}{!ordered.length&&<li className="py-6">{empty}</li>}</ul></>:empty}
  <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">{footer}{model&&checked.length>0&&<p aria-live="polite">{t(`تم تحديد ${checked.length} من ${items.length} صفوف`,`${checked.length} of ${items.length} row${items.length===1?"":"s"} selected`)}</p>}</div>
 </div>;
}
