export function inspectAttachment(bytes: Uint8Array, declared: string) {
 if (!bytes.length || bytes.length>5*1024*1024) throw new Error("File size");
 const mime=bytes[0]===0x25&&bytes[1]===0x50&&bytes[2]===0x44&&bytes[3]===0x46&&bytes[4]===0x2d ? "application/pdf"
 : bytes[0]===0xff&&bytes[1]===0xd8&&bytes[2]===0xff ? "image/jpeg"
 : [137,80,78,71,13,10,26,10].every((value,index)=>bytes[index]===value) ? "image/png" : null;
 if (!mime || mime!==declared) throw new Error("File type");
 return mime;
}
