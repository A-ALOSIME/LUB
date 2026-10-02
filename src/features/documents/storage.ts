import "server-only";
import {createHash} from "node:crypto";
import {createClient} from "@/lib/supabase/server";
import type {DocumentAsset} from "./repository";
export const documentBucket='lub-generated-documents';
export type DocumentUpload=DocumentAsset&{document_id:string;upload_attempt:string};
export function matchesDocument(bytes:Uint8Array,asset:Pick<DocumentAsset,'size_bytes'|'checksum_sha256'>){return bytes.byteLength===asset.size_bytes&&createHash('sha256').update(bytes).digest('hex')===asset.checksum_sha256;}
export async function storeDocument(asset:DocumentUpload){
 const bytes=Buffer.from(asset.body,'utf8');if(!matchesDocument(bytes,asset)||!['text/html','text/csv'].includes(asset.mime_type))throw new Error('Invalid immutable source');
 const bucket=(await createClient()).storage.from(documentBucket),options={contentType:asset.mime_type,upsert:false};
 const uploaded=await bucket.upload(asset.storage_key,bytes,options);
 const existing=await bucket.download(asset.storage_key);
 if(existing.data&&matchesDocument(new Uint8Array(await existing.data.arrayBuffer()),asset))return;
 if(uploaded.error&&existing.data){
  // A prior interrupted attempt may have left bad bytes. RLS permits cleanup
  // only while Generating; ready/archive files never become writable again.
  const removed=await bucket.remove([asset.storage_key]);if(removed.error)throw new Error('Upload cleanup unavailable');
  const retried=await bucket.upload(asset.storage_key,bytes,options);if(retried.error)throw new Error('Upload unavailable');
  const verified=await bucket.download(asset.storage_key);if(verified.data&&matchesDocument(new Uint8Array(await verified.data.arrayBuffer()),asset))return;
 }
 throw new Error('Stored bytes unavailable');
}
