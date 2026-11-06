import {expect,it} from "vitest";
import {listReturnPath,withReturnTo} from "./return-navigation";

it("preserves list filters and announcement anchors in internal return links",()=>{
 const origin="/manage/organizations/00000000-0000-4000-8000-000000000001/events?section=announcements&announcementSearch=design";
 const href=withReturnTo("/organizations/tech?section=announcements#announcement-1",origin);
 const url=new URL(href,"https://lub.community");
 expect(url.hash).toBe("#announcement-1");
 expect(url.searchParams.get("section")).toBe("announcements");
 expect(listReturnPath(url.searchParams.get("returnTo"),"/organizations")).toBe(origin);
 expect(withReturnTo("/events/123","/activity?tab=events&eventStatus=Accepted")).toContain("returnTo=%2Factivity%3Ftab%3Devents%26eventStatus%3DAccepted");
});

it("uses a safe fallback for direct visits and rejects non-list or external targets",()=>{
 for(const value of [undefined,null,[],["/activity"],"","https://example.com","//example.com","/\\example.com","/api/account","/login","/events/123","/%2f%2fexample.com"]){
  expect(listReturnPath(value,"/events/discover")).toBe("/events/discover");
 }
 expect(withReturnTo("/events/123","")).toBe("/events/123");
 expect(listReturnPath("/","/events/discover")).toBe("/");
 expect(listReturnPath("/organizations/tech?section=activities#events","/organizations")).toBe("/organizations/tech?section=activities#events");
});
