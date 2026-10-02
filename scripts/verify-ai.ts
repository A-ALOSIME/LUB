import {existsSync} from "node:fs";
import {retrievePublicSources} from "../src/features/ai/client";
if(existsSync('.env.local'))process.loadEnvFile('.env.local');
const started=performance.now();const result=await retrievePublicSources('كيف أقدم على عضوية نادي؟');
if(result.error||!result.sources?.some(s=>s.id==='membership')){console.error('Public knowledge connection verification failed; request and credentials omitted.');process.exitCode=1;}else console.log(JSON.stringify({connected:true,mode:'sources',generated:false,publicSources:result.sources.length,roundTripMs:Math.round(performance.now()-started),measurement:'local Next client to FastAPI; not browser timing'}));
