import {expect,it,vi} from "vitest";
vi.mock("server-only",()=>({}));
vi.mock("@/db/client",()=>({withUser:vi.fn(),withVisitor:vi.fn()}));
vi.mock("next/cache",()=>({unstable_cache:<T>(read:T)=>read}));
import {talentOrganizationLogo} from "./repository";
it("uses the existing organization logo when the stored value is blank",()=>{
 expect(talentOrganizationLogo("المجلس الاستشاري الطلابي لنظم المعلومات","")).toBe("/club-logos/is-council.png");
 expect(talentOrganizationLogo("المجلس الاستشاري الطلابي لنظم المعلومات","   ")).toBe("/club-logos/is-council.png");
});
it("preserves uploaded logos and uses letter fallback when no logo exists",()=>{
 expect(talentOrganizationLogo("المجلس الاستشاري الطلابي لنظم المعلومات","https://lub.community/custom.png")).toBe("https://lub.community/custom.png");
 expect(talentOrganizationLogo("جهة غير معروفة",null)).toBeNull();
});
