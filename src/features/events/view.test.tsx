// @vitest-environment jsdom
vi.mock("@/features/talent/activity-skill-actions",()=>({searchActivitySkills:vi.fn().mockResolvedValue([])}));
import { render, screen, cleanup, fireEvent, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
vi.mock("./actions",()=>({mutateEvent:vi.fn()}));
vi.mock("@/features/forms/actions",()=>({mutateWorkflow:vi.fn()}));
vi.mock("next/navigation",()=>({useRouter:()=>({refresh:vi.fn(),push:vi.fn()})}));
import { EventContent } from "./view";
import { EventPoster } from "./poster";
import type { EventDetail } from "./repository";
afterEach(()=>{cleanup();vi.unstubAllGlobals();});
const event:EventDetail={event:{id:"00000000-0000-4000-8000-000000000001",organization_id:"00000000-0000-4000-8000-000000000002",title:"ورشة البيانات",description:"وصف الورشة",location_type_code:"In_Person",location_text:"القاعة",online_url:null,starts_at:"2026-10-30T10:00:00Z",ends_at:"2026-10-30T11:00:00Z",registration_opens_at:"2026-10-20T10:00:00Z",registration_closes_at:"2026-10-29T10:00:00Z",capacity:10,attendance_hours:"2",status_code:"Published",is_featured:false,public_report:"",public_photos:[],revision:1,registration_form_template_id:null},org_name:"نادي البيانات",org_logo:null,org_type_code:"Club",slug:"data",status:"Active",onboarded:true,open:true,remaining:10,own:null,form:null,canManage:true,canAttend:true,registrations:[{id:"private-registration",user_id:"private-person",name:"اسم متقدم داخلي",status_code:"Registered",attendance:"Pending",answers:null,definition:null}],assets:[]};
it("keeps management tools and registrant data out of the public page and exposes one registration CTA",()=>{render(<EventContent data={event} user={false}/>);expect(screen.getByRole("button",{name:"سجّل في الفعالية"}).getAttribute("href")).toContain("/login?next=");expect(screen.queryByText("اسم متقدم داخلي")).toBeNull();expect(screen.queryByText("المسجلون والحضور")).toBeNull();expect(screen.queryByRole("button",{name:"تعديل"})).toBeNull();expect(screen.getByRole("button",{name:"إدارة الفعالية"}).getAttribute("href")).toContain("/manage/organizations/");expect(screen.queryByText("التسجيل في الفعالية")).toBeNull();});
it("keeps the published event title free of a redundant published badge",()=>{render(<EventContent data={event} user={false}/>);expect(screen.getByRole("heading",{level:1})).toHaveProperty("textContent","ورشة البيانات");expect(screen.queryByText("منشورة")).toBeNull();});
it("replaces failed poster images with a quiet icon and retains the full-image layout",()=>{render(<EventPoster src="/poster.png" title="ورشة"/>);const img=document.querySelector("img")!;expect(img.className).toBe("event-poster-contained-image");fireEvent.error(img);expect(document.querySelector("img")).toBeNull();expect(document.querySelector("svg")).toBeTruthy();});

it("copies only the public event URL where native sharing is unavailable", async () => {
  const writeText=vi.fn().mockResolvedValue(undefined);
  vi.stubGlobal("navigator",{clipboard:{writeText}});
  render(<EventContent data={event} user={false}/>);
  fireEvent.click(screen.getByRole("button",{name:"مشاركة الفعالية"}));
  await waitFor(()=>expect(writeText).toHaveBeenCalledWith(new URL(`/events/${event.event.id}`,window.location.origin).href));
});

it("uses native sharing when available and leaves the clipboard alone on cancellation", async () => {
  const share=vi.fn().mockRejectedValue(new DOMException("Cancelled","AbortError"));
  const writeText=vi.fn();
  vi.stubGlobal("navigator",{share,clipboard:{writeText}});
  render(<EventContent data={event} user={false}/>);
  await fireEvent.click(screen.getByRole("button",{name:"مشاركة الفعالية"}));
  expect(share).toHaveBeenCalledWith({title:event.event.title,url:new URL(`/events/${event.event.id}`,window.location.origin).href});
  expect(writeText).not.toHaveBeenCalled();
});

it("shows recorded attendance and only renders a join link authorized by the server", () => {
  const own={id:"registration",status_code:"Registered",review_status_code:"Accepted",attendance:"Present",response_revision:null,answers:{},version:null};
  const data={...event,own,event:{...event.event,online_url:"https://example.invalid/editor-only"}};
  const {rerender}=render(<EventContent data={data} user/>);
  expect(screen.getByText("تم رصد حضورك")).toBeTruthy();
  expect(screen.queryByRole("button",{name:"سجّل في الفعالية"})).toBeNull();
  expect(screen.queryByRole("link",{name:"رابط الحضور"})).toBeNull();
  const href="https://example.invalid/attendance";
  rerender(<EventContent data={{...data,event:{...data.event,attendance_url:href}}} user/>);
  const link=screen.getByRole("link",{name:"رابط الحضور"});
  expect(link.getAttribute("href")).toBe(href);
  expect(link.closest("li")?.querySelector("p")?.textContent).toBe("القاعة");
  expect(document.querySelector('a[href="https://example.invalid/editor-only"]')).toBeNull();
});
