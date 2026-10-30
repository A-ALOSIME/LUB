import {expect,it} from "vitest";
import {mergeRolePeriods} from "./role-periods";
it("merges repeated roles per organization with the widest dates and retains different roles",()=>{
 expect(mergeRolePeriods([{code:'Member',starts:'2026-09-12',ends:'2026-10-01',hours:'1.5'},{code:'OL',starts:'2026-10-15',ends:null,hours:'3'},{code:'Member',starts:'2026-10-02',ends:'2026-10-20',hours:'2'}])).toEqual([{code:'OL',starts:'2026-10-15',ends:null,hours:'3'},{code:'Member',starts:'2026-09-12',ends:'2026-10-20',hours:'3.5'}]);
 expect(mergeRolePeriods([{code:'Member',starts:'2026-09-01',ends:null,hours:'0'},{code:'Member',starts:'2026-08-01',ends:'2026-09-01',hours:'0'}])[0].ends).toBeNull();
});
