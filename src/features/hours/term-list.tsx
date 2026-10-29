import {t as translateUi} from "@/lib/i18n";
import {ArrowLeft,ArrowRight} from "lucide-react";
import {Badge} from "@/components/ui/badge";
import {Card,CardHeader,CardTitle,CardContent} from "@/components/ui/card";
import {formatRiyadhDate} from "@/lib/datetime";
import type {Locale} from "@/lib/preferences";
import type {Term} from "./repository";
export function TermList({terms,locale,today}:{terms:Term[];locale:Locale;today:string}){
 const en=locale==="en",Arrow=en?ArrowRight:ArrowLeft;
 if(!terms.length)return <p className="text-muted-foreground">{translateUi((en) ? "en" : "ar", "لا توجد فصول أكاديمية بعد.", "No academic terms yet.")}</p>;
 return <ul className="grid gap-4 lg:grid-cols-2">{terms.map(term=><li key={term.id}><Card className="h-full">
  <CardHeader><div className="flex flex-wrap items-center gap-2"><CardTitle><bdi>{term.name_ar} · {term.academic_year}</bdi></CardTitle>{term.start_date<=today&&term.end_date>=today&&<Badge variant="secondary">{translateUi((en) ? "en" : "ar", "الفصل الحالي", "Current term")}</Badge>}</div></CardHeader>
  <CardContent className="flex flex-col gap-2"><p className="flex flex-wrap items-center gap-2"><bdi>{formatRiyadhDate(term.start_date,locale)}</bdi><Arrow className="size-4" aria-label={translateUi((en) ? "en" : "ar", "إلى", "to")}/><bdi>{formatRiyadhDate(term.end_date,locale)}</bdi></p><p className="text-sm text-muted-foreground"><bdi>{term.term_code}</bdi></p></CardContent>
 </Card></li>)}</ul>;
}
