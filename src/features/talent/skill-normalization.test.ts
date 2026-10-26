import {expect,it} from "vitest";
import {displaySkills,skillKey} from "./skill-normalization";
it("deduplicates translated names and letter case without mutating the original skills",()=>{
 const source=["Python","بايثون","SQL","sql","تصميم"];
 expect(displaySkills(source)).toEqual(["Python","SQL","تصميم"]);
 expect(source).toEqual(["Python","بايثون","SQL","sql","تصميم"]);
 expect(skillKey(" SQL ")).toBe(skillKey("إس كيو إل"));
});
