import {localizedMetadata} from "@/lib/localized-metadata";
import Link from "next/link";
import {z} from "zod";
import {requireStudentUser as requireUser} from "@/features/auth/authorization";
import {myDocuments} from "@/features/documents/repository";
import type {DocumentItem} from "@/features/documents/repository";
import {checkReadiness} from "@/features/hours/view";
import {DocumentList,DocumentPager,DocumentsHelp} from "@/features/documents/view";
import {buttonVariants} from "@/components/ui/button";
import {getPreferences} from "@/lib/preferences";
export async function generateMetadata(){return localizedMetadata('مستنداتي','My documents');}
const documentExamples:DocumentItem[]=[
 {id:"sample-certificate",organization_id:"",document_type_code:"Hours_Certificate",status_code:"Ready",generated_at:"2026-10-12T09:30:00.000Z",name:"نادي التقنية (مثال)",scope:"الجهة بالكامل",period:"الفصل الأول 2026",total:"12",canArchive:false,canRetry:false},
 {id:"sample-report",organization_id:"",document_type_code:"Hours_Report",status_code:"Generating",generated_at:"2026-10-10T07:00:00.000Z",name:"مجلس طلابي (مثال)",scope:"لجنة المحتوى (مثال)",period:"الفصل الأول 2026",total:"24",canArchive:false,canRetry:false},
 {id:"sample-archived-certificate",organization_id:"",document_type_code:"Hours_Certificate",status_code:"Archived",generated_at:"2026-10-04T13:15:00.000Z",name:"نادي القراءة (مثال)",scope:"الجهة بالكامل",period:"الفصل الأول 2026",total:"8",canArchive:false,canRetry:false},
];
export default async function DocumentsPage({searchParams}:{searchParams:Promise<{page?:string|string[];preview?:string|string[]}>}){
 const [user,{locale}]=await Promise.all([requireUser(),getPreferences()]),q=await searchParams;
 const first=(value:string|string[]|undefined)=>Array.isArray(value)?value[0]:value;
 const preview=first(q.preview)==="1",page=preview?0:z.coerce.number().int().min(0).max(10000).catch(0).parse(first(q.page)??0);
 const data=await myDocuments(user.id,page);checkReadiness(data?.account);if(!data)throw new Error('Documents storage unavailable');
 const items=preview?documentExamples:data.items;
 return <main id="main" dir={locale==="en"?"ltr":"rtl"} className="w-full max-w-4xl space-y-6">
  <header className="flex flex-wrap items-end justify-between gap-3">
   <div><h1 className="text-2xl font-semibold tracking-tight">{locale==="en"?"My documents":"مستنداتي"}</h1><div className="mt-1">{preview?<p className="text-sm leading-6 text-muted">{locale==="en"?"Examples of ready, processing, and archived records.":"أمثلة على مستند جاهز وآخر قيد التجهيز وثالث مؤرشف."}</p>:<DocumentsHelp locale={locale}/>}</div></div>
   <Link className={buttonVariants({variant:"outline",size:"sm"})} href={preview?"/documents":"/documents?preview=1"}>{locale==="en"?(preview?"Back to my documents":"See examples"):(preview?"العودة إلى مستنداتي":"معاينة أمثلة")}</Link>
  </header>
  {preview&&<aside role="note" className="panel p-4 text-sm leading-6 text-muted">{locale==="en"?"These are sample document records for display only. They are not saved, and downloads or changes are disabled.":"هذه سجلات مستندات نموذجية للعرض فقط؛ غير محفوظة، والتنزيل أو التعديل غير متاح."}</aside>}
  <DocumentList items={items} preview={preview} locale={locale}/>
  {!preview&&<DocumentPager page={page} more={data.items.length>25} href={p=>`/documents?page=${p}`} locale={locale}/>}
 </main>;
}
