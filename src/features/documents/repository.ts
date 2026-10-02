import "server-only";
import {sql} from "drizzle-orm";
import {withUser} from "@/db/client";
import type {AccountReadiness,Term} from "@/features/hours/repository";

export type DocumentItem={id:string;organization_id:string;document_type_code:string;status_code:string;generated_at:string;name:string;scope:string;period:string;total:string;canArchive:boolean;canRetry:boolean};
export type DocumentsData={account:AccountReadiness;items:DocumentItem[]};
export type DocumentWorkspace=DocumentsData&{name:string;canGrant:boolean;scopes:Array<{id:string|null;name:string}>;terms:Term[];members:Array<{id:string;name:string;start_date:string;end_date:string|null}>;grantMembers:Array<{id:string;name:string}>;grants:Array<{id:string;name:string;committee_id:string|null;end_at:string|null}>};
const account=sql`jsonb_build_object('status',u.status_code,'onboarded',exists(select 1 from lub.student_profiles where user_id=u.id))`;
function documentRows(org:string|null,committee:string|null,page:number){return sql`coalesce((select jsonb_agg(x order by x.generated_at desc,x.id) from(
 select d.id,d.organization_id,d.document_type_code,d.status_code,d.generated_at,d.data_snapshot_json->>'organization' as name,d.data_snapshot_json->>'scope' as scope,d.data_snapshot_json->>'period' as period,d.data_snapshot_json->>'total' as total,(lub.has_org_permission(d.organization_id,'REPORTS_GENERATE') or lub.has_org_permission(d.organization_id,'REPORTS_GENERATE',d.committee_id)) as "canArchive",((d.status_code='Failed' or (d.status_code='Generating' and d.upload_started_at<statement_timestamp()-interval '15 minutes')) and (lub.has_org_permission(d.organization_id,'REPORTS_GENERATE') or lub.has_org_permission(d.organization_id,'REPORTS_GENERATE',d.committee_id))) as "canRetry"
 from lub.generated_documents d where (${org}::uuid is null or d.organization_id=${org}::uuid) and (${committee}::uuid is null or d.committee_id=${committee}::uuid) order by d.generated_at desc,d.id limit 26 offset ${page*25}
 ) x),'[]')`;}
export async function myDocuments(user:string,page:number){return withUser(user,async tx=>{
 const rows=await tx.execute(sql`select ${account} as account,${documentRows(null,null,page)} as items from lub.users u where u.id=${user}`);
 return rows[0] as unknown as DocumentsData|undefined;
});}
export async function documentWorkspace(user:string,org:string,committee:string|null,page:number,memberPage:number){return withUser(user,async tx=>{
 const rows=await tx.execute(sql`select ${account} as account,o.name_ar as name,lub.has_org_permission(o.id,'PERMISSIONS_GRANT') as "canGrant",
 coalesce((select jsonb_agg(s order by s.name) from(select null::uuid as id,'الجهة بالكامل' as name where lub.has_org_permission(o.id,'REPORTS_GENERATE') union all select c.id,c.name from lub.committees c where c.organization_id=o.id and c.status_code='Active' and lub.has_org_permission(o.id,'REPORTS_GENERATE',c.id) limit 100) s),'[]') as scopes,
 coalesce((select jsonb_agg(t order by t.start_date desc) from(select * from lub.academic_terms order by start_date desc limit 100) t),'[]') as terms,
 coalesce((select jsonb_agg(m) from lub.report_members(o.id,${committee}::uuid,${memberPage*25}) m),'[]') as members,
 coalesce((select jsonb_agg(m) from lub.report_grant_members(o.id,${memberPage*25}) m),'[]') as "grantMembers",lub.report_grants(o.id,${memberPage*25}) as grants,${documentRows(org,committee,page)} as items
 from lub.users u join lub.organizations o on o.id=${org} where u.id=${user} and lub.has_reports_access(o.id)`);
 return rows[0] as unknown as DocumentWorkspace|undefined;
});}
export type DocumentAsset={body:string;mime_type:string;original_name:string;storage_key:string;checksum_sha256:string;size_bytes:number};
export async function documentAsset(user:string,id:string){return withUser(user,async tx=>{
 const rows=await tx.execute(sql`select * from lub.document_asset(${id})`);return rows[0] as unknown as DocumentAsset|undefined;
});}
