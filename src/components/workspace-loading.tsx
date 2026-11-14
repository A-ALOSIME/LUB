import type {ReactNode} from "react";
import {LocalizedText} from "@/components/localized-text";
import {Card,CardContent} from "@/components/ui/card";
import {Skeleton} from "@/components/ui/skeleton";
import {cn} from "@/lib/utils";

const rows=[0,1,2];
const line=(className:string)=><Skeleton className={className}/>;

export function LoadingRegion({children,title,className}:{children:ReactNode;title?:[string,string];className?:string}) {
  return <div role="status" aria-busy="true" className={cn("flex min-w-0 flex-col gap-5",className)}>
    <span className="sr-only"><LocalizedText ar="جارٍ تحميل الصفحة…" en="Loading page…"/></span>
    {title&&<header className="workspace-page-header"><h1><LocalizedText ar={title[0]} en={title[1]}/></h1></header>}
    <div aria-hidden="true" className="flex min-w-0 flex-col gap-5">{children}</div>
  </div>;
}

export function TablePlaceholder({columns=4,thumbnail=false}:{columns?:number;thumbnail?:boolean}) {
  return <div className="divide-y divide-border">
    <div className="hidden items-center gap-3 px-3 py-3 md:flex">
      {Array.from({length:columns},(_,column)=><Skeleton key={column} className={cn("h-4",column===0?"me-auto w-20":"w-12 lg:w-16")}/>)}
    </div>
    {rows.map(row=><div key={row} className={cn("flex items-center gap-3 px-3 py-3",thumbnail&&"min-h-20")}>
      {thumbnail&&line("size-12 shrink-0 rounded-lg sm:w-16")}
      <Skeleton className="me-auto h-4 w-40 max-w-1/2"/>
      {Array.from({length:columns-1},(_,column)=><Skeleton key={column} className={cn("h-4 w-12 lg:w-16",column>0&&"hidden md:block")}/>)}
    </div>)}
  </div>;
}

export function ListLoading({title,tabs=0,columns=4,thumbnail=false,toolbar=true}:{title?:[string,string];tabs?:number;columns?:number;thumbnail?:boolean;toolbar?:boolean}) {
  return <LoadingRegion title={title}>
    {tabs>0&&<div className="flex max-w-full gap-1 rounded-lg border bg-card p-1 sm:w-fit">
      {Array.from({length:tabs},(_,tab)=><Skeleton key={tab} className="h-9 w-24 min-w-0 flex-1"/>)}
    </div>}
    {toolbar&&<div className="flex flex-wrap items-center gap-3">
      {line("h-10 w-full sm:w-72")}{line("h-9 w-56 max-w-full")}{line("h-9 w-24")}
    </div>}
    <TablePlaceholder columns={columns} thumbnail={thumbnail}/>
  </LoadingRegion>;
}

export function FormPlaceholder({fields=4,columns=false,avatar=false}:{fields?:number;columns?:boolean;avatar?:boolean}) {
  return <Card><CardContent className="space-y-5">
    {avatar&&<div className="flex items-center gap-3">{line("size-14 rounded-full")}{line("h-8 w-24")}</div>}
    <div className={cn("grid gap-5",columns&&"md:grid-cols-2")}>
      {Array.from({length:fields},(_,field)=><div key={field} className="space-y-2">{line("h-4 w-24")}{line("h-10 w-full")}</div>)}
    </div>
    <div className="flex flex-wrap gap-3 border-t pt-4">{line("h-10 w-28")}{line("h-10 w-16")}</div>
  </CardContent></Card>;
}

export function OverviewLoading({admin=false}:{admin?:boolean}) {
  return <LoadingRegion>
    {line("h-9 w-56 max-w-full")}
    <div className={cn("grid gap-4",admin?"sm:grid-cols-3":"md:grid-cols-2")}>
      {Array.from({length:admin?3:4},(_,item)=><Card key={item}><CardContent className="space-y-4">
        {line("h-5 w-32")}{line(admin?"h-8 w-12":"h-4 w-4/5")}{!admin&&line("h-8 w-24")}
      </CardContent></Card>)}
    </div>
  </LoadingRegion>;
}

export function TaskLoading() {
  return <LoadingRegion>
    {line("h-9 w-28")}{line("h-10 w-80 max-w-full")}{line("h-11 w-80 max-w-full")}
    <div className="grid min-w-0 items-start gap-5 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
      <Card><CardContent className="space-y-5">
        {line("h-5 w-40")}{line("h-4 w-full")}{line("h-4 w-3/4")}
        <div className="space-y-4 border-t pt-5">{line("h-5 w-32")}{line("h-20 w-full")}{line("h-9 w-40")}</div>
      </CardContent></Card>
      <Card><CardContent className="space-y-5">{line("h-5 w-28")}{line("h-7 w-20")}{line("h-5 w-44 max-w-full")}{line("h-1.5 w-full")}</CardContent></Card>
    </div>
  </LoadingRegion>;
}
