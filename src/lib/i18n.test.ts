import {expect,it} from "vitest";
import {formatNumber,localizeDigits,t} from "./i18n";
import {actionFeedback} from "./action-feedback";
it("formats display values per locale without changing the source value",()=>{const value="12.5";expect(formatNumber(value,"ar")).toBe("١٢٫٥");expect(formatNumber(value,"en")).toBe("12.5");expect(value).toBe("12.5");expect(localizeDigits("٠١٢","en")).toBe("012");});
it("translates action feedback and never leaks an unknown Arabic error into English",()=>{expect(actionFeedback("تعذّر حفظ صورة الحساب.","en")).toBe("Your account picture could not be saved.");expect(actionFeedback("رسالة جديدة غير مترجمة","en")).toBe("Please review the details and try again.");expect(t("ar","نسخة 3","Version 3")).toBe("نسخة ٣");expect(t("en","نسخة 3","Version 3")).toBe("Version 3");});
