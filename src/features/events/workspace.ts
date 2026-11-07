import "server-only";
import { sql } from "drizzle-orm";
import { withUser, withVisitor } from "@/db/client";
import type { Event } from "./repository";

export type EventWorkspace = {
  name: string;
  slug?: string;
  status: string | null;
  onboarded: boolean;
  canViewEvents: boolean;
  canManage: boolean;
  canManageAnnouncements: boolean;
  events: Array<Pick<Event, "id" | "organization_id" | "title" | "starts_at" | "ends_at" | "status_code" | "has_poster" | "revision" | "location_text" | "location_type_code"> & { registrant_count: number }>;
  templates: Array<{ id: string; name: string }>;
  announcements: import("@/features/organizations/announcement-types").ManagedAnnouncement[];
};

export async function eventWorkspaceOverview(user: string, org: string, page: number|null,filters?:{section?:string;eventStatus?:string;eventSearch?:string;sort?:string;announcementStatus?:string;announcementSearch?:string;announcementSort?:string;announcementPage?:number}) {
  return withUser(user, async tx => {
    const [row] = await tx.execute<{data:EventWorkspace|null}>(sql`select lub.event_management_page(${org},${page},${filters?JSON.stringify(filters):null}::jsonb) as data`);
    return row?.data??undefined;
  });
}

export async function publicEventPoster(id: string) {
  return withVisitor(async tx => {
    const rows = await tx.execute(sql`select p.*,lub.public_event_thumbnail(${id}) as thumbnail_png_base64 from lub.public_event_poster(${id}) p`);
    return rows[0] as { object_key: string; mime_type: string;thumbnail_png_base64?:string|null } | undefined;
  });
}

export async function privateEventPoster(user:string,id:string){return withUser(user,async tx=>{
 const rows=await tx.execute(sql`select * from lub.event_poster_for_viewer(${id})`);
 return rows[0] as {object_key:string;mime_type:string;thumbnail_png_base64?:string|null}|undefined;
});}
