import { expect,it } from "vitest";
import { inspectAttachment } from "./files";
it("checks actual attachment signatures and size before private upload",()=>{
 expect(inspectAttachment(new TextEncoder().encode("%PDF-1.7"),"application/pdf")).toBe("application/pdf");
 expect(inspectAttachment(new Uint8Array([137,80,78,71,13,10,26,10]),"image/png")).toBe("image/png");
 for (const [bytes,mime] of [[new TextEncoder().encode("<script>"),"application/pdf"],[new Uint8Array([255,216,255]),"image/png"],[new Uint8Array(5242881),"image/png"]] as const) expect(()=>inspectAttachment(bytes,mime)).toThrow();
});
