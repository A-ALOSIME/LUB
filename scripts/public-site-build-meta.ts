import {execFileSync} from "node:child_process";
import {statSync} from "node:fs";
export function legalContentUpdatedAt(){const path="src/features/legal/content.ts";try{const date=execFileSync("git",["log","-1","--format=%cs","--",path],{encoding:"utf8",windowsHide:true}).trim();const dirty=execFileSync("git",["status","--porcelain","--",path],{encoding:"utf8",windowsHide:true}).trim();if(date&&!dirty)return date;}catch{/* Source archives can be built without Git metadata. */}return statSync(path).mtime.toISOString();}
