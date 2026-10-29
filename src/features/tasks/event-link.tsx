import {createTranslator} from "@/lib/i18n";
import {Button} from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/native-select";
import Link from "next/link";
import type {TaskDetail} from "./repository";
import {TaskForm} from "./task-form";
import {eventLabels,eventLabelsEn} from "@/features/events/display";
import type {Locale} from "@/lib/preferences";
import { FormField } from "@/components/form-field";
export function TaskEventLink({detail:d,eventPage,query,locale="ar",onEventPageChange}:{detail:TaskDetail;eventPage:number;query:Record<string,string>;locale?:Locale;onEventPageChange?:(page:number)=>void}){
 const en=locale==="en",c=createTranslator(en ? "en" : "ar"),labels=en?eventLabelsEn:eventLabels;
 const choices=d.eventChoices,linked=d.linkedEvent,t=d.task,editable=d.canManage&&['Draft','Open'].includes(t.status_code);
 const href=(page:number)=>`/tasks/${t.id}?${new URLSearchParams({...query,eventPage:String(page)})}`;
 return <section className="flex flex-col gap-3 border-t border-border pt-4"><h2 className="text-xl font-semibold">{c("الفعالية المرتبطة","Linked event")}</h2>{linked?<Link href={`/events/${linked.id}`} className="text-link"><bdi>{linked.title}</bdi> · {labels[linked.status]}</Link>:<p className="text-muted">{t.event_id?c('تفاصيل الفعالية متاحة حسب صلاحية عرضها.','Event details are available according to your access.'):c('مهمة مستقلة.','Independent task.')}</p>}{editable&&<><TaskForm operation="link-event" fields={{task:t.id,revision:String(t.revision)}} label={c("حفظ ارتباط الفعالية","Save event link")} locale={locale}><FormField  label={<>{c("الفعالية","Event")}</>}><NativeSelect name="event" defaultValue={t.event_id??''}><option value="">{c("مهمة مستقلة","Independent task")}</option>{t.event_id&&!choices.slice(0,25).some(e=>e.id===t.event_id)&&<option value={t.event_id} dir="auto">{linked?.title??c('الفعالية الحالية','Current event')}</option>}{choices.slice(0,25).map(e=><option key={e.id} value={e.id} dir="auto">{e.title} · {labels[e.status]}</option>)}</NativeSelect></FormField></TaskForm><nav aria-label={c("صفحات اختيار الفعاليات","Event selection pages")} className="flex flex-wrap gap-4">{eventPage>0&&<Button variant="link" {...(onEventPageChange?{onClick:()=>onEventPageChange(eventPage-1)}:{render:<Link href={href(eventPage-1)}/>,nativeButton:false,role:"link" as const})}>{c("فعاليات سابقة","Previous events")}</Button>}{choices.length>25&&<Button variant="link" {...(onEventPageChange?{onClick:()=>onEventPageChange(eventPage+1)}:{render:<Link href={href(eventPage+1)}/>,nativeButton:false,role:"link" as const})}>{c("فعاليات أخرى","More events")}</Button>}</nav></>}</section>;
}
