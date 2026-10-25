import {expect,it} from "vitest";
import {formatHours,academicLevel,academicTerm} from "./display";
it("uses Latin digits and Arabic hour plurals",()=>{expect([1,2,3,10,11,0,1.5].map(n=>formatHours(n))).toEqual(["ساعة واحدة","ساعتان","3 ساعات","10 ساعات","11 ساعة","0 ساعة","1.5 ساعة"]);});
it("unifies academic levels and term labels",()=>{expect(academicLevel("5")).toBe("المستوى الخامس");expect(academicLevel("12")).toBe("المستوى الثاني عشر");expect(academicTerm("الترم الاول")).toBe("الفصل الدراسي الأول");});
