// @vitest-environment jsdom
import {render,screen,fireEvent,cleanup} from "@testing-library/react";
import {renderToStaticMarkup} from "react-dom/server";
import {afterEach,expect,it,vi} from "vitest";
vi.mock("next/navigation",()=>({useRouter:()=>({push:vi.fn()})}));
vi.mock("./lifecycle-controls",()=>({CampaignLifecycleControls:()=>null}));
vi.mock("@/features/forms/round-actions",()=>({RoundForm:()=>null}));
vi.mock("./draft-form",()=>({RenewalDraftForm:()=>null}));
vi.mock("@/components/row-action",()=>({RowAction:()=>null}));
vi.mock("@/features/forms/round-actions",()=>({RoundActions:()=>null}));
import {CombinedManagementList} from "./combined-management-list";
const campaign={id:"campaign",organization_id:"org",academic_term_id:"term",opens_at:"2026-10-25T00:00:00Z",closes_at:"2026-10-30T00:00:00Z",exclude_leadership:false,status_code:"Open",name:"حملة اختبار",org_name:"جهة اختبار",created_at:"2026-10-25T00:00:00Z"};
afterEach(()=>{vi.useRealTimers();cleanup();window.history.replaceState(null,"","/");});
it("keeps renewal campaign timing correct when there are no registration rounds",()=>{vi.useFakeTimers();vi.setSystemTime(new Date("2026-10-26T12:00:00Z"));const html=renderToStaticMarkup(<CombinedManagementList rounds={[]} campaigns={[campaign]} organization="org" locale="ar" canManageRounds={false}/>);expect(html).toContain("مفتوحة");expect(html).not.toContain("لم تبدأ بعد");});
it("hides archived campaigns from All and preserves them in the archive filter",()=>{render(<CombinedManagementList rounds={[]} campaigns={[{...campaign,status_code:"Archived"}]} organization="org" locale="ar" canManageRounds={false}/>);expect(screen.queryByText("حملة اختبار")).toBeNull();fireEvent.click(screen.getByRole("tab",{name:"مؤرشفة"}));expect(screen.getAllByText("حملة اختبار")).toHaveLength(2);});
