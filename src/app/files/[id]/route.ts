import { inspectAttachment } from "@/features/forms/files";
import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { z } from "zod";
import { getVerifiedUser } from "@/features/auth/session";
import { withUser } from "@/db/client";
import { createClient } from "@/lib/supabase/server";
import { getAuthConfig } from "@/lib/env";
export async function GET(_request: Request,{params}:{params:Promise<{id:string}>}) {
 const user=await getVerifiedUser();if(!user)return new NextResponse(null,{status:401});
 const {id}=await params;if(!z.uuid().safeParse(id).success)return new NextResponse(null,{status:404});
 try {
  const rows=await withUser(user.id,tx=>tx.execute(sql`select object_key,file_name,mime_type,size_bytes from lub.application_assets where id=${id}`));
  const asset=rows[0];if(!asset)return new NextResponse(null,{status:404});
  const client=await createClient();const bucket=client.storage.from("lub-application-files");
  const downloaded=await bucket.download(String(asset.object_key));if(downloaded.error||!downloaded.data||downloaded.data.size!==Number(asset.size_bytes))throw new Error("asset content");
  inspectAttachment(new Uint8Array(await downloaded.data.arrayBuffer()),String(asset.mime_type));
  const {data,error}=await client.storage.from("lub-application-files").createSignedUrl(String(asset.object_key),60,{download:String(asset.file_name)});
  if(error||!data||new URL(data.signedUrl).origin!==new URL(getAuthConfig()!.url).origin)throw new Error("download");
  return NextResponse.redirect(data.signedUrl,{status:303,headers:{"Cache-Control":"private, no-store","Referrer-Policy":"no-referrer"}});
 } catch { return new NextResponse(null,{status:503,headers:{"Cache-Control":"private, no-store"}}); }
}
