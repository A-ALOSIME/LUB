/** Decode display names only; retain encoded URLs and storage keys unchanged. */
export function displayFileName(name:string){try{return decodeURIComponent(name);}catch{return name;}}
