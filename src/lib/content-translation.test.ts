import {t} from "./i18n";
import {expect,it} from "vitest";
import {translateContent} from "./content-translation";
it("uses saved translations without changing Arabic source values",()=>{
 const source="نادي تكنيشن";
 expect(translateContent(source,"en")).toBe("Technician Club");
 expect(translateContent(source,"ar")).toBe(source);
 expect(source).toBe("نادي تكنيشن");
 expect(translateContent("المجلس الاستشاري الطلابي لنظم المعلومات","en")).toBe("Information Systems Student Advisory Council");
 expect(translateContent("  ماذا نقدم؟  ","en")).toBe("What we offer");
});
it("preserves unknown authored content and never translates URLs or personal identities",()=>{
 for(const source of ["أحمد العُصيمي","محتوى جديد بدون ترجمة محفوظة","https://example.com/نادي","person@example.com"])
  expect(translateContent(source,"en")).toBe(source);
});

it.each([
 ["نادي إنجاز","Enjaz Club"],
 ["نادي الإنجاز","Enjaz Club"],
 ["نادي تكنيشن","Technician Club"],
 ["نادي طويق","Tuwaiq Club"],
 ["نادي ظهير","Dhaheer Club"],
])("renders the English name of %s consistently in content and interface text",(source,english)=>{
 expect(translateContent(source,"en")).toBe(english);
 expect(t("en",`عرض ${source}`,`View ${source}`)).toBe(`View ${english}`);
 expect(translateContent(source,"ar")).toBe(source);
});
it("uses Latin brand names inside saved English descriptions too",()=>{
 expect(translateContent("كيف يعمل إنجاز؟","en")).toBe("How Enjaz works");
});
