import {execFileSync} from "node:child_process";
import {expect,it} from "vitest";

it("reuses a database client inside one real RSC render and isolates separate renders",()=>{
 const clientUrl=new URL("./client.ts",import.meta.url).href;
 const runtimeUrl=new URL("./runtime-url.ts",import.meta.url).href;
 const output=execFileSync(process.execPath,["--conditions=react-server","--import","tsx","--input-type=module","-e",`
 import {createElement} from 'react';import {renderToReadableStream} from 'react-server-dom-webpack/server.node';import assert from 'node:assert/strict';
 import {getDb} from ${JSON.stringify(clientUrl)};import {setHyperdriveDatabaseUrl} from ${JSON.stringify(runtimeUrl)};
 setHyperdriveDatabaseUrl('postgres://fixture:fixture@127.0.0.1:1/no-network');
 const clients=[];function Probe(){const first=getDb();assert.equal(first,getDb());clients.push(first);return createElement('span',null,'probe');}
 for(let i=0;i<2;i++)await new Response(await renderToReadableStream(createElement(Probe),{})).text();
 assert.equal(clients.length,2);assert.notEqual(clients[0],clients[1]);console.log('isolated');
 `],{encoding:"utf8",timeout:10000});
 expect(output.trim()).toBe("isolated");
});
