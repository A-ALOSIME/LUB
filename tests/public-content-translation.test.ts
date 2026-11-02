import {afterEach,expect,it,vi} from "vitest";
vi.mock('server-only',()=>({}));vi.mock('@/lib/env',()=>({getAuthConfig:()=>({url:'https://example.supabase.co',key:'test-public-key'})}));
import {translatePublicContent} from '../src/lib/public-content-translation';
afterEach(()=>vi.unstubAllGlobals());
it('keeps arbitrary English titles intact instead of resolving inherited object keys',async()=>{const fetcher=vi.fn();vi.stubGlobal('fetch',fetcher);expect(await translatePublicContent('constructor')).toBe('constructor');expect(fetcher).not.toHaveBeenCalled();});
it('uses complete approved Latin organization names without a provider request',async()=>{const fetcher=vi.fn();vi.stubGlobal('fetch',fetcher);expect(await translatePublicContent('نادي تكنيشن')).toBe('TechNation Club');expect(fetcher).not.toHaveBeenCalled();});
it('translates a new public event title through the shared Edge cache',async()=>{const fetcher=vi.fn(async()=>Response.json({translated_text:'New Data Science Camp'}));vi.stubGlobal('fetch',fetcher);expect(await translatePublicContent('معسكر علم البيانات الجديد')).toBe('New Data Science Camp');expect(fetcher).toHaveBeenCalledTimes(1);});
it('keeps the original metadata on network or provider failure',async()=>{vi.stubGlobal('fetch',vi.fn(async()=>{throw Error('offline');}));expect(await translatePublicContent('فعالية جديدة')).toBe('فعالية جديدة');});
