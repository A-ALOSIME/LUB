import { NextResponse, type NextRequest } from "next/server";
import { randomUUID } from "node:crypto";
import { sql } from "drizzle-orm";
import { getVerifiedUser } from "@/features/auth/session";
import { getAppOrigin } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import { withUser } from "@/db/client";
import { inspectAttachment } from "@/features/forms/files";
export async function POST(request: NextRequest) {
 if (request.headers.get("origin")!==getAppOrigin()) return new NextResponse(null,{status:403});
 const user=await getVerifiedUser(); if(!user)return new NextResponse(null,{status:401});
 if(Number(request.headers.get("content-length")??0)>6*1024*1024)return new NextResponse(null,{status:413});
 try {
  const form=await request.formData();const file=form.get("file");
  if (!(file instanceof File) || file.size>5242880 || !file.name || file.name.length>120 || /[\x00-\x1f/\\]/.test(file.name)) throw new Error("file");
  const bytes=new Uint8Array(await file.arrayBuffer());const mime=inspectAttachment(bytes,file.type);const id=randomUUID();const key=`${user.id}/${id}`;
  const client=await createClient();const bucket=client.storage.from("lub-application-files");
  const {error}=await bucket.upload(key,bytes,{contentType:mime,upsert:false});if(error)throw new Error("upload");
  try { await withUser(user.id,tx=>tx.execute(sql`select lub.register_application_asset(${id},${key},${file.name},${mime},${file.size})`)); }
  catch { await bucket.remove([key]);throw new Error("record"); }
  return NextResponse.json({id,name:file.name},{headers:{"Cache-Control":"private, no-store"}});
 } catch { return NextResponse.json({error:"تعذّر رفع الملف. اختر PDF أو JPEG أو PNG حتى 5 ميجابايت."},{status:400,headers:{"Cache-Control":"private, no-store"}}); }
}
