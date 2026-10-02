import {createHash} from "node:crypto";
import {beforeEach,expect,it,vi} from "vitest";
const mocks=vi.hoisted(()=>({user:vi.fn(),asset:vi.fn(),download:vi.fn()}));
vi.mock('server-only',()=>({}));vi.mock('@/lib/supabase/server',()=>({createClient:async()=>({storage:{from:()=>({download:mocks.download})}})}));
vi.mock('@/features/auth/session',()=>({getVerifiedUser:mocks.user}));vi.mock('@/features/documents/repository',()=>({documentAsset:mocks.asset}));
import {GET} from './route';
const id='00000000-0000-4000-8000-000000000001';
const call=(query='')=>GET(new Request(`http://localhost/documents/${id}/file${query}`),{params:Promise.resolve({id})});
beforeEach(()=>{vi.resetAllMocks();mocks.user.mockResolvedValue({id:'verified'});const body='<!doctype html><html lang="ar"><body>ساعات معتمدة</body></html>';mocks.asset.mockResolvedValue({body,mime_type:'text/html',original_name:`certificate-${id}.html`,storage_key:`documents/certificate-${id}.html`,size_bytes:Buffer.byteLength(body),checksum_sha256:createHash('sha256').update(body).digest('hex')});mocks.download.mockResolvedValue({data:new Blob([body]),error:null});});
it('denies visitors before touching private data',async()=>{mocks.user.mockResolvedValue(null);expect((await call()).status).toBe(401);expect(mocks.asset).not.toHaveBeenCalled();});
it('checks stored bytes and serves private UTF-8 attachments or a script-free print view',async()=>{
 const attachment=await call();expect(attachment.headers.get('Content-Disposition')).toContain('attachment;');expect(attachment.headers.get('Cache-Control')).toBe('private, no-store');expect(attachment.headers.get('Content-Security-Policy')).toContain("default-src 'none'");expect(attachment.headers.get('Content-Type')).toBe('text/html; charset=utf-8');expect(await attachment.text()).toContain('ساعات معتمدة');
 expect((await call('?view=print')).headers.get('Content-Disposition')).toContain('inline;');
 mocks.asset.mockResolvedValue({...await mocks.asset(),mime_type:'text/csv'});expect((await call('?view=print')).headers.get('Content-Disposition')).toContain('attachment;');
});
it('fails closed for checksum corruption and distinguishes denial from service failure',async()=>{
 mocks.asset.mockResolvedValue({...await mocks.asset(),checksum_sha256:'incorrect'});expect((await call()).status).toBe(503);
 mocks.asset.mockRejectedValue({code:'42501'});expect((await call()).status).toBe(404);mocks.asset.mockRejectedValue(new Error('offline'));expect((await call()).status).toBe(503);
});
