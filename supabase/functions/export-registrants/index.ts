import {createRegistrantsExportHandler} from "./handler.ts";
declare const Deno:{env:{get(name:string):string|undefined};serve(handler:(request:Request)=>Promise<Response>):unknown};
Deno.serve(createRegistrantsExportHandler({env:name=>Deno.env.get(name),fetcher:fetch}));
