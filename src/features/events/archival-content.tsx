import Link from "next/link";
import {EventPinAction} from "./pin-action";
import {Card,CardHeader,CardTitle,CardContent} from "@/components/ui/card";
import {Badge} from "@/components/ui/badge";
import {ContentText} from "@/components/content-text";
import {EventPoster} from "./poster";
import type {EventDetail} from "./repository";
import type {Locale} from "@/lib/preferences";
export function ArchivalEventContent({data,locale}:{data:EventDetail;locale:Locale}){const e=data.event;return <div className="mx-auto flex max-w-4xl flex-col gap-6"><Card><CardHeader><Link href={`/organizations/${data.slug}`} className="text-sm text-primary"><ContentText autoTranslate value={data.org_name}/></Link><CardTitle><h1 className="text-3xl font-semibold"><ContentText autoTranslate value={e.title}/></h1></CardTitle>{data.canFeature&&<EventPinAction id={e.id} pinned={e.is_featured} locale={locale}/>}<Badge variant="secondary">{locale==='ar'?'فعالية أرشيفية':'Archived event'}</Badge></CardHeader><CardContent className="flex flex-col gap-5">{e.has_poster&&<EventPoster src={`/event-posters/${e.id}`} title={e.title} locale={locale} detail/>}{e.source_date_text&&<p className="text-muted-foreground"><ContentText autoTranslate value={e.source_date_text}/></p>}{e.description&&<p className="whitespace-pre-line leading-relaxed"><ContentText autoTranslate value={e.description}/></p>}{e.location_text&&<p><ContentText autoTranslate value={e.location_text}/></p>}</CardContent></Card></div>;}
