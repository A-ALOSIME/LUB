import {expect,it} from "vitest";
import {imageDimensions} from "./image-dimensions";
it("reads natural PNG dimensions and ignores missing or unsafe dimensions",()=>{const b=new Uint8Array(24);b.set([137,80,78,71]);const v=new DataView(b.buffer);v.setUint32(16,1800);v.setUint32(20,1200);expect(imageDimensions(b)).toEqual({width:1800,height:1200});v.setUint32(20,0);expect(imageDimensions(b)).toBeNull();expect(imageDimensions(new Uint8Array(3))).toBeNull();});
it("reads JPEG frame dimensions without decoding image content",()=>{expect(imageDimensions(new Uint8Array([255,216,255,192,0,9,8,4,176,7,8,3,0]))).toEqual({width:1800,height:1200});expect(imageDimensions(new Uint8Array([255,216,255,192,255,255]))).toBeNull();});
