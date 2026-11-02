import {afterEach,expect,it,vi} from "vitest";
vi.mock('server-only',()=>({}));
import {encryptIdentifier} from "@/lib/identifiers";
import {decodeMemberWorkspace,decodeMemberRecord} from "./member-identifiers";
import type {EncryptedMemberWorkspace,EncryptedMemberRecord} from "./member-types";
afterEach(()=>vi.unstubAllEnvs());
it('decrypts only the fields requested by the authorized view and strips ciphertexts and private user IDs',()=>{
 vi.stubEnv('IDENTIFIER_ENCRYPTION_KEY',Buffer.alloc(32,1).toString('base64'));vi.stubEnv('IDENTIFIER_LOOKUP_KEY',Buffer.alloc(32,2).toString('base64'));
 const user='00000000-0000-4000-8000-000000000001',universityCiphertext=encryptIdentifier('0441234567',user),nationalCiphertext=encryptIdentifier('1000000000',user,'national-id');
 const raw:EncryptedMemberRecord={id:'membership',userId:user,name:'طالب',major:'الحاسب',level:'5',status:'Active',startDate:'2026-01-01',endDate:null,universityCiphertext,nationalCiphertext,email:'student@example.invalid',phone:'+966551234567',avatar:null,organization:{name:'الجهة',slug:'test'},hours:10,roles:[],committees:[],events:[]};
 const result=decodeMemberRecord(raw);expect(result.universityId).toBe('0441234567');expect(result.nationalId).toBe('1000000000');expect(JSON.stringify(result)).not.toContain(universityCiphertext);expect(JSON.stringify(result)).not.toContain(nationalCiphertext);expect(result).not.toHaveProperty('userId');
 const directory:EncryptedMemberWorkspace={canManage:true,canGrant:true,canAddHours:true,terms:[],committees:[],members:[{...raw,roles:[],committees:[],canManage:true,hourScopes:[]}]};
 const view=decodeMemberWorkspace(directory);expect(view.members[0].universityId).toBe('0441234567');expect(view.members[0]).not.toHaveProperty('nationalId');expect(JSON.stringify(view)).not.toContain('Ciphertext');expect(view.members[0]).not.toHaveProperty('userId');
});
