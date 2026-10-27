import {beforeEach,expect,it,vi} from 'vitest';
const mock=vi.hoisted(()=>({requireUser:vi.fn(),updateUser:vi.fn(),verifyOtp:vi.fn(),getUser:vi.fn(),sync:vi.fn(),cookies:new Map<string,string>()}));
vi.mock('@/features/auth/session',()=>({requireUser:mock.requireUser}));
vi.mock('@/lib/supabase/server',()=>({createClient:async()=>({auth:{updateUser:mock.updateUser,verifyOtp:mock.verifyOtp,getUser:mock.getUser}})}));
vi.mock('./repository',()=>({syncVerifiedAccountEmail:mock.sync}));
vi.mock('next/cache',()=>({revalidatePath:vi.fn()}));
vi.mock('next/headers',()=>({cookies:async()=>({get:(key:string)=>{const value=mock.cookies.get(key);return value?{value}:undefined;},set:(key:string,value:string)=>mock.cookies.set(key,value),delete:(key:string)=>mock.cookies.delete(key)})}));
import {changeAccountEmail,changeAccountPassword} from './security-actions';
const user={id:'verified-user',email:'old@example.invalid',emailVerifiedAt:'2026-10-20T10:00:00Z'};
const form=(values:Record<string,string>)=>{const f=new FormData();Object.entries(values).forEach(([k,v])=>f.set(k,v));return f;};
beforeEach(()=>{vi.clearAllMocks();mock.cookies.clear();vi.stubEnv('APP_URL','http://127.0.0.1:4271');mock.requireUser.mockResolvedValue(user);mock.updateUser.mockResolvedValue({error:null});mock.verifyOtp.mockResolvedValue({error:null});mock.getUser.mockResolvedValue({data:{user:{id:user.id,email:'new@example.invalid',email_confirmed_at:user.emailVerifiedAt}},error:null});});
it('requests confirmation while leaving the current account email untouched',async()=>{
 const result=await changeAccountEmail({},form({operation:'request',email:'new@example.invalid',userId:'forged'}));
 expect(mock.updateUser).toHaveBeenCalledWith({email:'new@example.invalid'},{emailRedirectTo:'http://127.0.0.1:4271/auth/callback'});expect(mock.sync).not.toHaveBeenCalled();expect(result.pendingEmail).toBe('new@example.invalid');
 expect((await changeAccountEmail({},form({operation:'request',email:user.email}))).error).toBeTruthy();expect(mock.updateUser).toHaveBeenCalledTimes(1);
});
it('confirms only the pending email for the verified owner and syncs after provider confirmation',async()=>{
 await changeAccountEmail({},form({operation:'request',email:'new@example.invalid'}));const result=await changeAccountEmail({},form({operation:'confirm',email:'forged@example.invalid',token:'١٢٣٤٥٦'}));
 expect(mock.verifyOtp).toHaveBeenCalledWith({email:'new@example.invalid',token:'123456',type:'email_change'});expect(mock.sync).toHaveBeenCalledWith({...user,email:'new@example.invalid'});expect(result.completed).toBe(true);expect(mock.cookies.has('lub-pending-email')).toBe(false);
});
it('retains the original email until secure email change confirms both required emails',async()=>{
 await changeAccountEmail({},form({operation:'request',email:'new@example.invalid'}));mock.getUser.mockResolvedValue({data:{user:{id:user.id,email:user.email,email_confirmed_at:user.emailVerifiedAt}},error:null});
 const result=await changeAccountEmail({},form({operation:'confirm',token:'123456'}));expect(result.completed).not.toBe(true);expect(result.pendingEmail).toBe('new@example.invalid');expect(mock.sync).not.toHaveBeenCalled();
});
it('does not persist a different authenticated identity or expose provider errors',async()=>{
 await changeAccountEmail({},form({operation:'request',email:'new@example.invalid'}));mock.getUser.mockResolvedValue({data:{user:{id:'other-user',email:'new@example.invalid',email_confirmed_at:user.emailVerifiedAt}},error:null});expect((await changeAccountEmail({},form({operation:'confirm',token:'123456'}))).error).toBeTruthy();expect(mock.sync).not.toHaveBeenCalled();
 mock.updateUser.mockResolvedValue({error:{message:'private provider details'}});expect(JSON.stringify(await changeAccountEmail({},form({operation:'request',email:'else@example.invalid'})))).not.toContain('private provider details');
});
it('validates password confirmation before calling the provider and does not return the password',async()=>{
 const password='fictional-unit-test-password';expect((await changeAccountPassword({},form({password,confirmation:'mismatch'}))).error).toBeTruthy();expect(mock.updateUser).not.toHaveBeenCalled();const result=await changeAccountPassword({},form({password,confirmation:password}));expect(mock.updateUser).toHaveBeenCalledWith({password});expect(result.success).toBeTruthy();expect(JSON.stringify(result)).not.toContain(password);
});
