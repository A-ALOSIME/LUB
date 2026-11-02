import {expect,it,vi,afterEach} from "vitest";
vi.mock('server-only',()=>({}));
import {encryptIdentifier} from "../src/lib/identifiers";
import {csvCell,membersCsv} from "../supabase/functions/export-members/csv";
import type {EncryptedMemberRecord} from "../src/features/organizations/member-types";
afterEach(()=>vi.unstubAllEnvs());
it('protects formula prefixes, quotes, line breaks, and preserves raw leading-zero identifiers as text',()=>{
 for(const value of ['=1+1','+123','-123','@SUM(A1)','  =1+1','\t=1+1'])expect(csvCell(value)).toContain("'");
 expect(csvCell('0440000',true)).toBe('"\'0440000"');expect(csvCell('نص "مقتبس"\nثان')).toBe('"نص ""مقتبس""\nثان"');
});
it('decrypts Node AES-GCM envelopes inside Edge WebCrypto and emits UTF-8 BOM with current-org details',async()=>{
 const secret=Buffer.alloc(32,3).toString('base64');vi.stubEnv('IDENTIFIER_ENCRYPTION_KEY',secret);vi.stubEnv('IDENTIFIER_LOOKUP_KEY',Buffer.alloc(32,4).toString('base64'));
 const user='00000000-0000-4000-8000-000000000001';const row:EncryptedMemberRecord={id:'m',userId:user,name:'=1+1',major:'الحاسب',level:'5',status:'Active',startDate:'2026-10-01',endDate:null,universityCiphertext:encryptIdentifier('0441234567',user),nationalCiphertext:encryptIdentifier('1000000000',user,'national-id'),email:'student@example.invalid',phone:'+966551234567',avatar:null,organization:{name:'المجلس',slug:'qa'},hours:10,roles:[],committees:[],events:[]};
 const csv=await membersCsv([row],secret,'ar');expect(csv.charCodeAt(0)).toBe(0xfeff);expect(csv).toContain('الرقم الجامعي');expect(csv).toContain('"\'0441234567"');expect(csv).toContain('"\'=1+1"');expect(csv).not.toContain(row.universityCiphertext);expect(csv).not.toContain(user);
});
