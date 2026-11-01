import {writeFileSync} from "node:fs";
import postgres from "postgres";
import {databaseTLS} from "../src/db/tls";
import {imageDimensions} from "../src/lib/image-dimensions";

// Maintenance only: read existing public posters; never replace an uploaded file.
const apply = process.argv.includes("--apply");
if (!process.env.DATABASE_URL) throw Error("DATABASE_URL is required");
const client = postgres(process.env.DATABASE_URL, {max:1,prepare:false,ssl:databaseTLS(process.env.DATABASE_URL),onnotice:()=>{}});
try {
  const posters = await client<{id:string;asset_id:string}[]>`select e.id,a.id as asset_id from lub.events e join lub.event_assets ea on ea.event_id=e.id and ea.asset_type_code='Poster' join lub.application_assets a on a.id=ea.asset_id where e.published_at is not null and e.status_code<>'Draft' and a.image_width is null and a.image_height is null`;
  const results: Array<{id:string;asset_id:string;width:number;height:number}> = [];
  for (const poster of posters) {
    const response = await fetch(`https://lub.community/event-posters/${poster.id}`, {signal:AbortSignal.timeout(30000)});
    if (!response.ok || !/^image\/(png|jpeg)/.test(response.headers.get('content-type')??'')) throw Error("Public poster is unavailable");
    const dimensions = imageDimensions(new Uint8Array(await response.arrayBuffer()));
    if (!dimensions) throw Error("Could not read public poster dimensions");
    results.push({...poster,...dimensions});
  }
  if (apply) await client.begin(async tx => {
    for (const poster of results) await tx`update lub.application_assets set image_width=${poster.width},image_height=${poster.height} where id=${poster.asset_id} and image_width is null and image_height is null`;
  });
  writeFileSync('tmp/event-poster-dimensions.json',JSON.stringify({applied:apply,posters:results},null,2));
  console.log(`${apply?'Updated':'Previewed'} ${results.length} existing poster dimensions`);
} catch {
  console.error("Poster metadata maintenance failed; no connection details were logged.");
  process.exitCode=1;
} finally {await client.end();}
