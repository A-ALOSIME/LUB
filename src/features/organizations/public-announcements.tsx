"use client";
import {useState} from "react";
import Image from "next/image";
import {ExternalLink,Pin,ChevronDown} from "lucide-react";
import {Card,CardHeader,CardTitle,CardDescription,CardContent,CardFooter} from "@/components/ui/card";
import {Badge} from "@/components/ui/badge";
import {Button} from "@/components/ui/button";
import {Collapsible,CollapsibleContent,CollapsibleTrigger} from "@/components/ui/collapsible";
import {formatRiyadhDate} from "@/lib/datetime";
import type {PublicAnnouncement} from "./announcement-types";
import type {Locale} from "@/lib/preferences";
function AnnouncementCard({item,locale}:{item:PublicAnnouncement;locale:Locale}){
 const [expanded,setExpanded]=useState(false),en=locale==="en",long=item.body.length>500;
 return <Card><CardHeader><div className="flex flex-wrap items-start justify-between gap-3"><CardTitle dir="auto" className="break-words">{item.title}</CardTitle>{item.pinned&&<Badge variant="secondary"><Pin/>{en?"Pinned":"مثبّت"}</Badge>}</div><CardDescription><time dateTime={item.published_at}>{formatRiyadhDate(item.published_at,locale)}</time></CardDescription></CardHeader><CardContent className="flex min-w-0 flex-col gap-4">
 {long?<Collapsible open={expanded} onOpenChange={setExpanded}>{!expanded&&<p dir="auto" className="whitespace-pre-wrap break-words leading-8">{item.body.slice(0,500)}…</p>}<CollapsibleContent><p dir="auto" className="whitespace-pre-wrap break-words leading-8">{item.body}</p></CollapsibleContent><CollapsibleTrigger render={<Button variant="ghost" size="sm"/>}><ChevronDown/>{expanded?(en?"Show less":"عرض أقل"):(en?"Show more":"عرض المزيد")}</CollapsibleTrigger></Collapsible>:<p dir="auto" className="whitespace-pre-wrap break-words leading-8">{item.body}</p>}
 {item.has_image&&<Image src={`/announcement-images/${item.id}`} width={1000} height={700} unoptimized alt={item.title} sizes="(max-width:767px) 100vw, 60rem" className="h-auto w-full rounded-lg"/>}
 </CardContent>{item.external_url&&<CardFooter><Button variant="outline" render={<a href={item.external_url} target="_blank" rel="noopener noreferrer"/>} nativeButton={false}>{en?"Read more":"اقرأ المزيد"}<ExternalLink/></Button></CardFooter>}</Card>;
}
export function PublicAnnouncements({items,locale="ar"}:{items:PublicAnnouncement[];locale?:Locale}){return <section className="flex min-w-0 flex-col gap-5" aria-label={locale==="en"?"Announcements":"الإعلانات"}>{items.map(item=><AnnouncementCard key={item.id} item={item} locale={locale}/>)}</section>;}
