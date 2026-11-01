import {existsSync,readdirSync,readFileSync,writeFileSync,mkdirSync} from "node:fs";
import {resolve} from "node:path";
import {createHash} from "node:crypto";
import postgres from "postgres";
import {databaseTLS} from "../src/db/tls";
import {parseMarkdownOrganizations} from "./organization-markdown";
const sourceRoot=resolve(process.env.LUB_MARKDOWN_SOURCE??"C:/Users/AF9VI/Documents/LUB/clubs_councils"),apply=process.argv.includes('--apply'),output=resolve(process.env.LUB_RESTORE_REPORT??"tmp/markdown-restoration-result.json");
if(!existsSync(sourceRoot))throw Error(`Missing source directory: ${sourceRoot}`);
const documents=readdirSync(sourceRoot).filter(file=>file.endsWith('.md')).map(file=>({file,text:readFileSync(resolve(sourceRoot,file),'utf8')}));
const drafts=parseMarkdownOrganizations(documents),expected=new Set(drafts.flatMap(d=>d.files));const unexpected=documents.filter(d=>!expected.has(d.file));if(unexpected.length)throw Error('Unmapped Markdown files: '+unexpected.map(d=>d.file).join(', '));
if(existsSync('.env.local'))process.loadEnvFile('.env.local');if(!process.env.DATABASE_URL)throw Error('DATABASE_URL is required');
const client=postgres(process.env.DATABASE_URL,{max:1,prepare:false,connect_timeout:10,ssl:databaseTLS(process.env.DATABASE_URL),onnotice:()=>{}});
try{const report=await client.begin(async tx=>{await tx`select pg_advisory_xact_lock(727029)`;const admins=await tx`select distinct u.id from lub.users u join auth.users a on a.id=u.id join lub.global_role_assignments r on r.user_id=u.id where u.status_code='Active' and a.email_confirmed_at is not null and lower(a.email)=lower(u.email) and r.role_code='SA' and r.start_at<=now() and (r.end_at is null or r.end_at>now())`;if(admins.length!==1)throw Error('Expected one verified Super Admin operator');await tx`select set_config('request.jwt.claim.sub','',true)`;const result=[];for(const draft of drafts){const found=await tx`select id from lub.organizations where slug=${draft.slug}`;if(found.length!==1)throw Error(`Organization match is not unique: ${draft.slug}`);const [row]=await tx`select lub.restore_markdown_organization(${JSON.stringify(draft)}::jsonb) as result`;result.push({...draft,...row.result});}if(!apply){const preview=new Error('ROLLBACK_PREVIEW') as Error&{preview?:typeof result};preview.preview=result;throw preview;}return result;}).catch(error=>{if(error instanceof Error&&error.message==='ROLLBACK_PREVIEW'&&'preview' in error)return (error as Error&{preview:unknown[]}).preview;throw error;});
const reportData={sourceRoot,applied:apply,createdAt:new Date().toISOString(),files:documents.map(d=>({file:d.file,sha256:createHash('sha256').update(d.text).digest('hex')})),organizations:report};
// Only source content and field-level results enter the report; no account credentials.
mkdirSync(resolve(output,'..'),{recursive:true});writeFileSync(output,JSON.stringify(reportData,null,2),'utf8');console.log(`${apply?'Restored':'Previewed'} ${report.length} organizations; report: ${output}`);
}catch{console.error("Markdown restoration failed; no connection details were logged. Check source validation and database owner access.");process.exitCode=1;}finally{await client.end();}
