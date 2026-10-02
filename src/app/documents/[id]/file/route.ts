import {z} from "zod";
import {getVerifiedUser} from "@/features/auth/session";
import {documentAsset} from "@/features/documents/repository";
import {documentFileCsp} from "@/features/documents/security";
import {createClient} from "@/lib/supabase/server";
import {documentBucket,matchesDocument} from "@/features/documents/storage";
const headers={'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','Content-Security-Policy':documentFileCsp};
export async function GET(request:Request,{params}:{params:Promise<{id:string}>}){
 const user=await getVerifiedUser();if(!user)return new Response(null,{status:401,headers});const {id}=await params;if(!z.uuid().safeParse(id).success)return new Response(null,{status:404,headers});
 try{
  const asset=await documentAsset(user.id,id);if(!asset)return new Response(null,{status:404,headers});
  const file=await (await createClient()).storage.from(documentBucket).download(asset.storage_key);if(file.error||!file.data)throw new Error();const bytes=Buffer.from(await file.data.arrayBuffer());if(!matchesDocument(bytes,asset)||!['text/csv','text/html'].includes(asset.mime_type))throw new Error();
  const inline=asset.mime_type==='text/html'&&new URL(request.url).searchParams.get('view')==='print';
  return new Response(bytes,{headers:{...headers,'Content-Type':`${asset.mime_type}; charset=utf-8`,'Content-Disposition':`${inline?'inline':'attachment'}; filename="${asset.original_name}"`}});
 }catch(error){const denied=typeof error==='object'&&error!==null&&'code' in error&&error.code==='42501';return new Response(null,{status:denied?404:503,headers});}
}
