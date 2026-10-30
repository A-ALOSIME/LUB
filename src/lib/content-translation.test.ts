import {expect,it} from "vitest";
import {translateContent} from "./content-translation";
it("uses saved translations without changing Arabic source values or proper brands",()=>{
 const source="نادي تكنيشن";
 expect(translateContent(source,"en")).toBe("تكنيشن Club");
 expect(translateContent(source,"ar")).toBe(source);
 expect(source).toBe("نادي تكنيشن");
 expect(translateContent("المجلس الاستشاري الطلابي لنظم المعلومات","en")).toBe("Information Systems Student Advisory Council");
 expect(translateContent("  ماذا نقدم؟  ","en")).toBe("What we offer");
});
it("preserves unknown authored content and never translates URLs or personal identities",()=>{
 for(const source of ["أحمد العُصيمي","محتوى جديد بدون ترجمة محفوظة","https://example.com/نادي","person@example.com"])
  expect(translateContent(source,"en")).toBe(source);
});
