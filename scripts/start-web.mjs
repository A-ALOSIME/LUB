import {existsSync} from "node:fs";
if(existsSync('.env.local'))process.loadEnvFile('.env.local');
process.env.HOSTNAME??='127.0.0.1';
await import('../.next/standalone/server.js');
