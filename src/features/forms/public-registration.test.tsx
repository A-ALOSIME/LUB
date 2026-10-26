import {renderToStaticMarkup} from "react-dom/server";
import {expect,it,vi} from "vitest";
vi.mock("./repository",()=>({statuses:{Submitted:"قيد المراجعة"}}));
import {PublicRegistration} from "./public-registration";
const round={id:"round",title:"جولة جديدة",open:true,opens_at:"2026-10-25T10:00:00Z",closes_at:"2026-10-30T10:00:00Z"};
it("always renders the closed application section without old-round links",()=>{
 const html=renderToStaticMarkup(<PublicRegistration slug="test" signedIn={false} locale="ar"/>);
 expect(html).toContain("التقديم للانضمام");expect(html).toContain("التسجيل مغلق حاليًا");expect(html).not.toContain("قدّم الآن");
});
it("shows one current round with a login return to the application",()=>{
 const html=renderToStaticMarkup(<PublicRegistration round={round} slug="test" signedIn={false} locale="ar"/>);
 expect(html).toContain("قدّم الآن");expect(html).toContain("/login?next=%2Forganizations%2Ftest%2Fapply%2Fround");
});
it("shows the opening date for upcoming rounds and the existing request status",()=>{
 const upcoming=renderToStaticMarkup(<PublicRegistration round={{...round,open:false}} slug="test" signedIn locale="ar"/>);
 expect(upcoming).toContain("يفتح التسجيل في");expect(upcoming).not.toContain("قدّم الآن");
 const own=renderToStaticMarkup(<PublicRegistration round={round} slug="test" signedIn locale="ar" application={{id:"own",status_code:"Submitted"}}/>);
 expect(own).toContain("قيد المراجعة");expect(own).not.toContain("قدّم الآن");
});
