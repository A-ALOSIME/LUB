export function launchConfiguration(env:Record<string,string|undefined>,local=false){
 const origin=(value:string|undefined,allowLocal:boolean)=>{try{const u=new URL(value??"");const loopback=["localhost","127.0.0.1","[::1]"].includes(u.hostname);return !u.username&&!u.password&&!u.search&&!u.hash&&u.pathname==="/"&&(allowLocal||!loopback)&&(u.protocol==="https:"||(allowLocal&&u.protocol==="http:"&&loopback));}catch{return false;}};
 const key=env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY??"";let publishable=key.startsWith("sb_publishable_");
 if(!publishable)try{publishable=JSON.parse(Buffer.from(key.split('.')[1]??"",'base64url').toString()).role==="anon";}catch{publishable=false;}
 const encryption=Buffer.from(env.IDENTIFIER_ENCRYPTION_KEY??"",'base64'),lookup=Buffer.from(env.IDENTIFIER_LOOKUP_KEY??"",'base64');
 let database=false;
 // TLS is enforced by databaseTLS; don't accept an explicit insecure URL override.
 if(env.DATABASE_URL)try{const u=new URL(env.DATABASE_URL);database=["postgres:","postgresql:"].includes(u.protocol)&&Boolean(u.username&&u.password)&&!['disable','allow','prefer'].includes(u.searchParams.get('sslmode')??'')&&(local||!["localhost","127.0.0.1","[::1]"].includes(u.hostname));}catch{database=false;}
 const aiUrl=env.AI_SERVICE_URL??'',aiToken=env.AI_SERVICE_TOKEN??'';
 return {appOrigin:origin(env.APP_URL,local),supabaseOrigin:origin(env.NEXT_PUBLIC_SUPABASE_URL,local),publishableKey:publishable,identifierKeys:encryption.length===32&&lookup.length===32&&!encryption.equals(lookup),databaseUrl:database,aiConnection:(!aiUrl&&!aiToken)||Boolean(aiUrl&&aiToken.length>=32),noPublicSecrets:!Object.keys(env).some(k=>k.startsWith('NEXT_PUBLIC_')&&/SECRET|SERVICE_ROLE|DATABASE|IDENTIFIER|AI_SERVICE_TOKEN/.test(k))};
}
