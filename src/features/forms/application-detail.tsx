import type { Detail } from "./repository";
import { statuses } from "./repository";
import type { Locale } from "@/lib/preferences";

const statusesEn: Record<string, string> = { Draft: "Draft", Published: "Published", Open: "Open", Closed: "Closed", Archived: "Archived", Submitted: "Under review", Interview: "Interview", Accepted: "Accepted", Rejected: "Rejected", Withdrawn: "Withdrawn" };

export function ApplicationDetail({detail,locale="ar"}:{detail:Detail;locale?:Locale}) {
 const en=locale==="en",label=(status:string)=>en?statusesEn[status]??status:statuses[status];
 return <div className="space-y-6"><p className="font-semibold">{en?"Application status":"حالة الطلب"}: {label(detail.status_code)}</p><p className="text-sm text-muted">{en?`Form version ${detail.version.version_number} — saved with your application`:`نسخة النموذج ${detail.version.version_number} — محفوظة مع طلبك`}</p>
 <dl className="space-y-5">{detail.version.definition.sections.flatMap(s=>s.fields).filter(f=>detail.answers[f.id]!==undefined).map(f=><div key={f.id}><dt dir="auto" className="font-medium">{f.label}</dt><dd dir="auto" className="mt-2 whitespace-pre-line break-words leading-8 text-muted">{f.type==="File"?<a className="text-link" href={`/files/${detail.answers[f.id]}`}>{en?"Download attachment":"تنزيل المرفق"}</a>:f.type==="Checkbox"?en?"Agreed":"موافق":f.options.length?(Array.isArray(detail.answers[f.id])?detail.answers[f.id] as string[]:[String(detail.answers[f.id])]).map(value=>f.options.find(o=>o.value===value)?.label??value).join(en?", ":"، "):String(detail.answers[f.id])}</dd></div>)}</dl>
 <section><h2 className="text-lg font-semibold">{en?"Interview messages":"رسائل المقابلة"}</h2>{detail.messages.length?detail.messages.map((m,i)=><p key={i} dir="auto" className="mt-3 whitespace-pre-line leading-8">{m.body}</p>):<p className="mt-3 text-muted">{en?"No messages yet.":"لا توجد رسائل."}</p>}</section>
 <section><h2 className="text-lg font-semibold">{en?"Application history":"سجل الطلب"}</h2><ol className="mt-3 space-y-2 text-sm text-muted">{detail.history.map((h,i)=><li key={i}>{label(h.to_status_code)}{h.reason==="Undo"?en?" · Undone":" · تراجع":""} · {new Date(h.created_at).toLocaleString(en?"en-US":"ar-SA",{timeZone:"Asia/Riyadh",calendar:"gregory"})}</li>)}</ol></section>
 {detail.canReview&&<section><h2 className="text-lg font-semibold">{en?"Internal reviewer notes":"ملاحظات داخلية للمراجعين"}</h2>{detail.notes.map((n,i)=><p key={i} dir="auto" className="mt-3 whitespace-pre-line leading-8">{n.body}</p>)}</section>}</div>;
}
