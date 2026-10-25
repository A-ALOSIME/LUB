// @vitest-environment jsdom
import {afterEach,expect,it,vi} from "vitest";
import {cleanup,fireEvent,render,screen,waitFor} from "@testing-library/react";
import {AvatarPicker,prepareAvatar} from "./avatar-picker";
afterEach(()=>{cleanup();vi.restoreAllMocks();vi.unstubAllGlobals();});
it("rejects unsupported and oversized source files before decoding",async()=>{
 const decode=vi.fn();vi.stubGlobal("createImageBitmap",decode);
 await expect(prepareAvatar(new File(["svg"],"a.svg",{type:"image/svg+xml"}))).rejects.toThrow();
 await expect(prepareAvatar(new File([new Uint8Array(2097153)],"a.png",{type:"image/png"}))).rejects.toThrow();
 expect(decode).not.toHaveBeenCalled();
});
it("previews the converted image before saving and returns to the initial on removal",async()=>{
 const change=vi.fn(),close=vi.fn();vi.stubGlobal("createImageBitmap",vi.fn().mockResolvedValue({width:512,height:384,close}));
 vi.spyOn(HTMLCanvasElement.prototype,"getContext").mockReturnValue({drawImage:vi.fn()} as unknown as CanvasRenderingContext2D);
 vi.spyOn(HTMLCanvasElement.prototype,"toBlob").mockImplementation(callback=>callback(({type:"image/webp",size:32,arrayBuffer:async()=>{const b=new Uint8Array(32),v=new DataView(b.buffer);b.set(new TextEncoder().encode("RIFF"));v.setUint32(4,24,true);b.set(new TextEncoder().encode("WEBPVP8 "),8);v.setUint32(16,12,true);b.set([157,1,42],23);v.setUint16(26,256,true);v.setUint16(28,256,true);return b.buffer;}} as Blob)));
 Object.defineProperty(URL,"createObjectURL",{configurable:true,value:vi.fn(()=>"blob:avatar")});Object.defineProperty(URL,"revokeObjectURL",{configurable:true,value:vi.fn()});
 render(<AvatarPicker name="أحمد" locale="ar" onChange={change} onProcessing={vi.fn()}/>);
 expect(screen.getByText("أ")).toBeTruthy();fireEvent.change(screen.getByLabelText("اختيار صورة الحساب"),{target:{files:[new File(["png"],"a.png",{type:"image/png"})]}});
 await waitFor(()=>expect(change).toHaveBeenCalled());expect(change.mock.calls[0][0].type).toBe("image/webp");expect(close).toHaveBeenCalled();
 expect(screen.getByRole("button",{name:"حذف الصورة"})).toBeTruthy();fireEvent.click(screen.getByRole("button",{name:"حذف الصورة"}));expect(change).toHaveBeenLastCalledWith(null);expect(screen.queryByRole("button",{name:"حذف الصورة"})).toBeNull();
});
