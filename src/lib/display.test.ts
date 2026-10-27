import {expect,it} from "vitest";
import {formatHours,academicLevel,academicTerm,formatCount} from "./display";
it("uses Latin digits and Arabic hour plurals",()=>{expect([1,2,3,10,11,0,1.5].map(n=>formatHours(n))).toEqual(["ساعة واحدة","ساعتان","3 ساعات","10 ساعات","11 ساعة","لا ساعات","1.5 ساعة"]);});
it("unifies academic levels and term labels",()=>{expect(academicLevel("5")).toBe("المستوى الخامس");expect(academicLevel("12")).toBe("المستوى الثاني عشر");expect(academicTerm("الترم الاول")).toBe("الفصل الدراسي الأول");});

it("shares zero, singular, dual, plural and large Arabic counts across units",()=>{
 expect([0,1,2,3,10,11,101].map(n=>formatCount(n,"rounds"))).toEqual(["لا جولات","جولة واحدة","جولتان","3 جولات","10 جولات","11 جولة","101 جولة"]);
 expect(formatCount(0,"records")).toBe("لا سجلات");expect(formatCount(2,"records","ar","oblique")).toBe("سجلين");
 expect(formatCount(12,"records")).toBe("12 سجلًا");expect(formatCount(2,"versions")).toBe("نسختان");expect(formatCount(0,"members")).toBe("لا أعضاء");expect(formatCount(12,"members")).toBe("12 عضوًا");expect(formatCount(2,"rounds","en")).toBe("2 rounds");
});

it("can show numeric zero in compact statistics without changing empty-state wording",()=>{expect(formatCount(0,"events","ar","nominative","number")).toBe("0 فعاليات");expect(formatCount(0,"organizations","ar","nominative","number")).toBe("0 جهات");expect(formatCount(0,"hours","ar","nominative","number")).toBe("0 ساعة");expect(formatCount(0,"events")).toBe("لا فعاليات");});
