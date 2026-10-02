import {cp,mkdir} from "node:fs/promises";
import {fileURLToPath} from "node:url";
const root=fileURLToPath(new URL('../',import.meta.url));
await cp(root+'.next/static',root+'.next/standalone/.next/static',{recursive:true});
await cp(root+'public',root+'.next/standalone/public',{recursive:true});
await mkdir(root+'.next/standalone/config',{recursive:true});
await cp(root+'config/supabase-prod-ca-2021.crt',root+'.next/standalone/config/supabase-prod-ca-2021.crt');
console.log('Standalone public and static assets and database CA prepared.');
