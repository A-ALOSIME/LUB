export function exportBytes(value:string){return Uint8Array.from(atob(value),c=>c.charCodeAt(0));}
export async function decryptExportIdentifier(envelope:string,user:string,kind:string,key:CryptoKey){
 const [version,nonce,tag,ciphertext,extra]=envelope.split('.');if(version!=="v1"||!nonce||!tag||!ciphertext||extra!==undefined)throw new Error("Invalid envelope");
 const data=exportBytes(ciphertext),authTag=exportBytes(tag),combined=new Uint8Array(data.length+authTag.length);combined.set(data);combined.set(authTag,data.length);
 const plain=await crypto.subtle.decrypt({name:"AES-GCM",iv:exportBytes(nonce),additionalData:new TextEncoder().encode(`lub:${kind}:${user}`),tagLength:128},key,combined);
 return new TextDecoder().decode(plain);
}
