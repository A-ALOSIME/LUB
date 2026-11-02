import {createTranslationHandler} from "./handler.ts";

declare const Deno:{env:{get(name:string):string|undefined};serve(handler:(request:Request)=>Promise<Response>):unknown};

// Provider credentials exist only in the hosted function's environment.
Deno.serve(createTranslationHandler({env:name=>Deno.env.get(name),fetcher:fetch}));
