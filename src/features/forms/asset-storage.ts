const extensions:Record<string,string>={"application/pdf":"pdf","image/jpeg":"jpg","image/png":"png"};
export function assetExtension(mime:string){const extension=extensions[mime];if(!extension)throw new Error("Unsupported asset type");return extension;}
export function assetStorageName(id:string,mime:string){return `${id}.${assetExtension(mime)}`;}
