import {expect,it,vi} from "vitest";
import {createTranslationHandler} from "../supabase/functions/translate-content/handler";
import {protectNames,readTranslationXml} from "../supabase/functions/translate-content/policy";

function fixture(overrides:Record<string,string|undefined>={}){
 const cache=new Map<string,string>(),provider=vi.fn(async()=>Response.json({translations:[{text:'<text>Technology Club</text>'}]}));
 let limited=false;
 const env:Record<string,string|undefined>={SUPABASE_URL:'https://example.supabase.co',SUPABASE_SERVICE_ROLE_KEY:'test-service-role',DEEPL_API_KEY:'test-key:fx',...overrides};
 const fetcher:typeof fetch=vi.fn(async(input,init)=>{
  const url=String(input),body=JSON.parse(String(init?.body));
  if(url.startsWith('https://api-free.deepl.com/')||url.startsWith('https://api.deepl.com/'))return provider();
  if(url.endsWith('/translation_lookup'))return Response.json(cache.get(body.p_hash)??null);
  if(url.endsWith('/translation_reserve'))return Response.json(limited?{state:'limited'}:{state:'reserved',request_id:'00000000-0000-4000-8000-000000000001'});
  if(url.endsWith('/translation_finish')){if(body.p_translated!==null)cache.set(body.p_hash,body.p_translated);return new Response(null,{status:204});}
  throw Error('Unexpected endpoint');
 });
 return{handler:createTranslationHandler({env:name=>env[name],fetcher}),provider,fetcher,cache,limit:()=>{limited=true;}};
}
function request(text='نادي التقنية',target_lang='EN'){return new Request('https://example.supabase.co/functions/v1/translate-content',{method:'POST',headers:{'content-type':'application/json',origin:'https://lub.community'},body:JSON.stringify({text,target_lang})});}

it('translates Arabic to English once, serves the second request from cache, and hashes changed text separately',async()=>{
 const f=fixture();const first=await(await f.handler(request())).json(),second=await(await f.handler(request())).json(),changed=await(await f.handler(request('لجنة التقنية'))).json();
 expect(first).toMatchObject({translated_text:'Technology Club',cached:false,target_lang:'EN',source_lang:'AR'});
 expect(second).toMatchObject({translated_text:'Technology Club',cached:true});expect(second.source_hash).toBe(first.source_hash);
 expect(changed.source_hash).not.toBe(first.source_hash);expect(f.provider).toHaveBeenCalledTimes(2);expect(f.cache.size).toBe(2);
});
it.each([['', 'EN'],['x'.repeat(10001),'EN'],['نادي التقنية','AR']])('rejects empty, oversized and reverse-direction requests before external calls',async(text,lang)=>{const f=fixture();expect((await f.handler(request(text,lang))).status).toBe(400);expect(f.fetcher).not.toHaveBeenCalled();});
it('does not expose keys or cache a provider failure',async()=>{const f=fixture();f.provider.mockResolvedValue(Response.json({message:'internal provider details'},{status:403}));const response=await f.handler(request());expect(response.status).toBe(502);const body=await response.text();expect(body).not.toContain('test-key');expect(body).not.toContain('internal provider');expect(f.cache.size).toBe(0);});
it('keeps cache misses uncached when the key is disabled or missing',async()=>{for(const env of [{DEEPL_TRANSLATION_ENABLED:'false'},{DEEPL_API_KEY:''}]){const f=fixture(env);expect((await f.handler(request())).status).toBe(503);expect(f.provider).not.toHaveBeenCalled();expect(f.cache.size).toBe(0);}});
it('honors the shared server rate limit without calling DeepL',async()=>{const f=fixture();f.limit();expect((await f.handler(request())).status).toBe(429);expect(f.provider).not.toHaveBeenCalled();});
it('escapes untrusted XML and preserves the exact special names',()=>{const source='لُـبّ مع إنجاز وتكنيشن <script> & نص';const xml=protectNames(source);expect(xml).toContain('<keep>لُـبّ</keep>');expect(xml).toContain('<keep>إنجاز</keep>');expect(xml).toContain('<keep>تكنيشن</keep>');expect(xml).toContain('&lt;script&gt;');expect(readTranslationXml(xml,source)).toBe(source);expect(()=>readTranslationXml('<text>Names removed</text>',source)).toThrow();});
it('rejects unrelated website origins',async()=>{const f=fixture();const req=request();const other=new Request(req,{headers:{'content-type':'application/json',origin:'https://other.example'}});expect((await f.handler(other)).status).toBe(403);expect(f.fetcher).not.toHaveBeenCalled();});
