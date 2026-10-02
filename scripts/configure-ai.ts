import {randomBytes} from "node:crypto";
import {appendFileSync,existsSync} from "node:fs";
if(existsSync('.env.local'))process.loadEnvFile('.env.local');
const updates:string[]=[];
if(!process.env.AI_SERVICE_URL)updates.push('AI_SERVICE_URL=http://127.0.0.1:8000');
if(!process.env.AI_SERVICE_TOKEN)updates.push(`AI_SERVICE_TOKEN=${randomBytes(32).toString('hex')}`);
if(updates.length)appendFileSync('.env.local',`\n# Internal public-knowledge service; server-only\n${updates.join('\n')}\n`);
console.log('Local AI service connection prepared. No model provider key is configured by this script.');
