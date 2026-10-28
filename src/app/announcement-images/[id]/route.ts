import {z} from "zod";
import {sql} from "drizzle-orm";
import {withVisitor} from "@/db/client";
import {createClient} from "@/lib/supabase/server";
const headers={"Cache-Control":"private, no-store","X-Content-Type-Options":"nosniff","Referrer-Policy":"no-referrer","Cross-Origin-Resource-Policy":"same-origin"};
export async function GET(_request:Request,{params}:{params:Promise<{id:string}>}){
 const {id}=await params;if(!z.uuid().safeParse(id).success)return new Response(null,{status:404,headers});
 try{
  const image=await withVisitor(async tx=>(await tx.execute(sql`select * from lub.public_announcement_image(${id})`))[0] as {object_key:string;mime_type:string}|undefined);
  if(!image||!["image/jpeg","image/png"].includes(image.mime_type))return new Response(null,{status:404,headers});
  const {data,error}=await(await createClient()).storage.from("lub-application-files").download(image.object_key);if(error||!data)return new Response(null,{status:404,headers});
  return new Response(data,{headers:{...headers,"Content-Type":image.mime_type}});
 }catch{return new Response(null,{status:404,headers});}
}
