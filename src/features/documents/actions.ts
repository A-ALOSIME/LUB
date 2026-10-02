"use server";
import {z} from "zod";
import {sql} from "drizzle-orm";
import {revalidatePath} from "next/cache";
import {requireUser} from "@/features/auth/session";
import {withUser} from "@/db/client";
import {storeDocument,type DocumentUpload} from "./storage";
export type DocumentState={error?:string;success?:string;document?:string};
export async function mutateDocument(_previous:DocumentState,f:FormData):Promise<DocumentState>{
 const user=await requireUser();let document:string|undefined;
 const uuid=(key:string)=>z.uuid().parse(f.get(key)),optionalUuid=(key:string)=>f.get(key)?uuid(key):null;
 try{
  const op=z.enum(['generate','retry','archive','grant','end-grant']).parse(f.get('operation'));
  const query=(()=>{switch(op){
   case 'generate':{const period=z.enum(['All','Term','Year','Custom']).parse(f.get('period'));const kind=z.enum(['Hours_Report','Hours_Certificate']).parse(f.get('kind'));const value=period==='Term'?uuid('term'):period==='Year'?z.string().min(1).max(20).parse(f.get('year')):null;const starts=period==='Custom'?z.iso.date().parse(f.get('starts')):null,ends=period==='Custom'?z.iso.date().parse(f.get('ends')):null;return sql`select lub.generate_document(${uuid('org')},${optionalUuid('committee')},${kind},${kind==='Hours_Certificate'?uuid('member'):null},${period},${value},${starts}::date,${ends}::date) as id`;}
   case 'archive':if(f.get('confirm')!=='on')throw new Error();return sql`select lub.archive_document(${uuid('document')})`;
   case 'retry':return sql`select lub.retry_document(${uuid('document')}) as id`;
   case 'grant':return sql`select lub.grant_report_permission(${uuid('member')},${optionalUuid('committee')},${f.get('ends')?z.iso.datetime({offset:true}).parse(f.get('ends')):null}::timestamptz)`;
   case 'end-grant':if(f.get('confirm')!=='on')throw new Error();return sql`select lub.end_report_permission(${uuid('grant')})`;
  }})();if(op==='generate'||op==='retry'){
   const rows=await withUser(user.id,tx=>tx.execute(sql`with created as materialized(${query}) select upload.* from created cross join lateral lub.document_upload(created.id) upload`));const upload=rows[0] as unknown as DocumentUpload;document=z.uuid().parse(upload?.document_id);
   try{await storeDocument(upload);await withUser(user.id,tx=>tx.execute(sql`select lub.complete_document(${document},${upload.upload_attempt},true)`));}
   catch{try{await withUser(user.id,tx=>tx.execute(sql`select lub.complete_document(${document},${upload.upload_attempt},false)`));}catch{/* An interrupted connection leaves a recoverable Generating attempt. */}
    revalidatePath('/documents');revalidatePath('/manage','layout');return {error:'حُفظت نسخة البيانات، لكن تعذّر تجهيز الملف في التخزين. افتح سجل المستندات وأعد تجهيز نفس النسخة؛ المحاولة المنقطعة تصبح قابلة للإعادة بعد ١٥ دقيقة.',document};
   }
  }else await withUser(user.id,tx=>tx.execute(query));
 }catch{return{error:"تعذّر إنشاء المستند أو حفظ التغيير. تحقق من النطاق والفترة والصلاحية ووجود ساعات معتمدة. قسّم الفترة إذا تجاوزت ٥٬٠٠٠ سجل."};}
 revalidatePath('/documents');revalidatePath('/manage','layout');revalidatePath('/me');
 return {success:document?'تم حفظ نسخة ثابتة من البيانات والملف.':'تم حفظ التغيير.',document};
}
