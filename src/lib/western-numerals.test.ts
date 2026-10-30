import {expect,it} from "vitest";
import {formatNumber,localizeDigits,t} from "./i18n";
import {formatRiyadhDateTime} from "./datetime";
it.each(["ar","en"] as const)("always renders Western digits in %s",locale=>{
 expect(formatNumber(1234.5,locale)).toBe("1,234.5");
 expect(localizeDigits("٠١٢٣٤٥٦٧٨٩ / ۰۱۲۳۴۵۶۷۸۹")).toBe("0123456789 / 0123456789");
 expect(formatRiyadhDateTime("2026-10-29T12:30:00+03:00",locale)).not.toMatch(/[٠-٩۰-۹]/u);
 expect(t(locale,"نسخة ٣","Version 3")).not.toMatch(/[٠-٩]/u);
});
