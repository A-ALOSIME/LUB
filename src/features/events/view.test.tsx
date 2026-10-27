// @vitest-environment jsdom
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
vi.mock("./actions",()=>({mutateEvent:vi.fn()}));
vi.mock("@/features/forms/actions",()=>({mutateWorkflow:vi.fn()}));
vi.mock("next/navigation",()=>({useRouter:()=>({refresh:vi.fn(),push:vi.fn()})}));
import { EventContent } from "./view";
import { EventPoster } from "./poster";
import type { EventDetail } from "./repository";
afterEach(cleanup);
const event:EventDetail={event:{id:"00000000-0000-4000-8000-000000000001",organization_id:"00000000-0000-4000-8000-000000000002",title:"ورشة البيانات",description:"وصف الورشة",location_type_code:"In_Person",location_text:"القاعة",online_url:null,starts_at:"2026-10-30T10:00:00Z",ends_at:"2026-10-30T11:00:00Z",registration_opens_at:"2026-10-20T10:00:00Z",registration_closes_at:"2026-10-29T10:00:00Z",capacity:10,attendance_hours:"2",status_code:"Published",is_featured:false,public_report:"",public_photos:[],revision:1,registration_form_template_id:null},org_name:"نادي البيانات",org_logo:null,org_type_code:"Club",slug:"data",status:"Active",onboarded:true,open:true,remaining:10,own:null,form:null,canManage:true,canAttend:true,canContribute:true,registrations:[{id:"private-registration",user_id:"private-person",name:"اسم متقدم داخلي",status_code:"Registered",attendance:"Pending",answers:null,definition:null}],contributions:[],assets:[]};
it("keeps management tools and registrant data out of the public page and exposes one registration CTA",()=>{render(<EventContent data={event} user={false}/>);expect(screen.getByRole("button",{name:"سجّل في الفعالية"}).getAttribute("href")).toContain("/login?next=");expect(screen.queryByText("اسم متقدم داخلي")).toBeNull();expect(screen.queryByText("المسجلون والحضور")).toBeNull();expect(screen.queryByRole("button",{name:"تعديل"})).toBeNull();expect(screen.getByRole("button",{name:"إدارة الفعالية"}).getAttribute("href")).toContain("/manage/organizations/");expect(screen.queryByText("التسجيل في الفعالية")).toBeNull();});
it("replaces failed poster images with a quiet icon and retains the full-image layout",()=>{render(<EventPoster src="/poster.png" title="ورشة"/>);const img=document.querySelector("img")!;expect(img.className).toBe("event-poster-contained-image");fireEvent.error(img);expect(document.querySelector("img")).toBeNull();expect(document.querySelector("svg")).toBeTruthy();});
