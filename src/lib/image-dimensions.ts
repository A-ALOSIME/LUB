/** Read dimensions from verified PNG/JPEG bytes without decoding an image. */
export function imageDimensions(bytes:Uint8Array):{width:number;height:number}|null{
 const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
 const result=(width:number,height:number)=>width>0&&height>0&&width<=100000&&height<=100000?{width,height}:null;
 if(bytes.length>=24&&bytes[0]===137&&bytes[1]===80&&bytes[2]===78&&bytes[3]===71)return result(view.getUint32(16),view.getUint32(20));
 if(bytes.length<4||bytes[0]!==255||bytes[1]!==216)return null;
 let offset=2;while(offset+4<=bytes.length){if(bytes[offset++]!==255)return null;while(offset<bytes.length&&bytes[offset]===255)offset++;const marker=bytes[offset++];if(marker===217||marker===218)return null;if(marker===1||marker>=208&&marker<=215)continue;if(offset+2>bytes.length)return null;const size=view.getUint16(offset);if(size<2||offset+size>bytes.length)return null;if([192,193,194,195,197,198,199,201,202,203,205,206,207].includes(marker)&&size>=7)return result(view.getUint16(offset+5),view.getUint16(offset+3));offset+=size;}return null;
}
