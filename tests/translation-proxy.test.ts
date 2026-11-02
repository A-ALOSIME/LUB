import {afterEach,expect,it,vi} from "vitest";
vi.mock('@/lib/env',()=>({getAuthConfig:()=>({url:'https://example.supabase.co',key:'test-public-key'})}));
import {POST} from '../src/app/api/translations/route';
afterEach(()=>vi.unstubAllGlobals());
const request=(input:unknown={text:'نادي التقنية',target_lang:'EN'},origin='https://lub.community')=>new Request('https://lub.community/api/translations',{method:'POST',headers:{origin,'content-type':'application/json'},body:JSON.stringify(input)});
it('forwards only AR to EN to the fixed Edge URL, without a provider secret',async()=>{
 const fetcher=vi.fn(async()=>Response.json({translated_text:'Technology Club',source_hash:'internal'}));vi.stubGlobal('fetch',fetcher);
 const response=await POST(request());expect(response.status).toBe(200);expect(await response.json()).toEqual({translated_text:'Technology Club'});
 const [url,options]=fetcher.mock.calls[0] as unknown as [string,RequestInit];expect(url).toBe('https://example.supabase.co/functions/v1/translate-content');expect(JSON.parse(String(options.body))).toEqual({text:'نادي التقنية',source_lang:'AR',target_lang:'EN'});expect(JSON.stringify(options.headers)).not.toContain('DEEPL');
});
it('blocks cross-origin and reverse translation before calling upstream',async()=>{
 const fetcher=vi.fn();vi.stubGlobal('fetch',fetcher);expect((await POST(request({},'https://other.example'))).status).toBe(403);expect((await POST(request({text:'Name',target_lang:'AR'}))).status).toBe(400);expect(fetcher).not.toHaveBeenCalled();
});
it('does not expose upstream failure details',async()=>{
 vi.stubGlobal('fetch',vi.fn(async()=>Response.json({debug:'private provider failure'},{status:500})));
 const response=await POST(request());expect(response.status).toBe(502);expect(await response.text()).not.toContain('private provider');
});
