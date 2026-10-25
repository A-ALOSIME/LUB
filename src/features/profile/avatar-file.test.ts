import {expect,it} from "vitest";
import {inspectAvatar,stripAvatarMetadata} from "./avatar-file";
function picture() {const bytes=new Uint8Array(32),view=new DataView(bytes.buffer);bytes.set(new TextEncoder().encode("RIFF"));view.setUint32(4,24,true);bytes.set(new TextEncoder().encode("WEBPVP8 "),8);view.setUint32(16,12,true);bytes.set([0x9d,1,0x2a],23);view.setUint16(26,256,true);view.setUint16(28,256,true);return bytes;}
it("accepts only a bounded still WebP with the intended avatar dimensions",()=>{
 expect(()=>inspectAvatar(picture(),"image/webp")).not.toThrow();
 expect(()=>inspectAvatar(picture(),"image/png")).toThrow();
 expect(()=>inspectAvatar(new Uint8Array(65537),"image/webp")).toThrow();
 const dimensions=picture();new DataView(dimensions.buffer).setUint16(26,4096,true);expect(()=>inspectAvatar(dimensions,"image/webp")).toThrow();
 const truncated=picture().slice(0,29);expect(()=>inspectAvatar(truncated,"image/webp")).toThrow();
 const metadata=new Uint8Array(44);metadata.set(picture());metadata.set(new TextEncoder().encode("EXIF"),32);new DataView(metadata.buffer).setUint32(4,36,true);new DataView(metadata.buffer).setUint32(36,4,true);expect(()=>inspectAvatar(metadata,"image/webp")).toThrow();
 const animation=picture();animation.set(new TextEncoder().encode("ANIM"),12);expect(()=>inspectAvatar(animation,"image/webp")).toThrow();
});

it("strips canvas color metadata and clears its extended-header flags",()=>{
 const image=picture(),bytes=new Uint8Array(12+18+12+20);bytes.set(image.slice(0,12));const view=new DataView(bytes.buffer);view.setUint32(4,bytes.length-8,true);bytes.set(new TextEncoder().encode("VP8X"),12);view.setUint32(16,10,true);bytes[20]=32;bytes[24]=255;bytes[27]=255;bytes.set(new TextEncoder().encode("ICCP"),30);view.setUint32(34,4,true);bytes.set(image.slice(12),42);
 const stripped=stripAvatarMetadata(bytes);expect(stripped.length).toBe(bytes.length-12);expect(()=>inspectAvatar(stripped,"image/webp")).not.toThrow();expect(new TextDecoder().decode(stripped)).not.toContain("ICCP");
});
