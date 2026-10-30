import {expect,it} from "vitest";
import {displayFileName} from "./file-name";
it("decodes original attachment names without breaking malformed escapes or plus signs",()=>{
 expect(displayFileName('%D8%AA%D8%B3%D9%84%D9%8A%D9%85%20final.pdf')).toBe('تسليم final.pdf');
 expect(displayFileName('report+draft.pdf')).toBe('report+draft.pdf');
 expect(displayFileName('100% draft.pdf')).toBe('100% draft.pdf');
});
