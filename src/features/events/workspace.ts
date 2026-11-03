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
    const rows = await tx.execute(sql`
      select
        o.name_ar as name,o.slug,
        (select status_code from lub.users where id=${user}) as status,
        exists(select 1 from lub.student_profiles where user_id=${user}) as onboarded,
        lub.has_event_access(o.id) as "canViewEvents",
        lub.has_org_permission(o.id, 'EVENTS_MANAGE') as "canManage",
        lub.has_org_permission(o.id, 'ORG_PROFILE_MANAGE') as "canManageAnnouncements",
        case when lub.has_event_access(o.id) and (${!filters?.section}::boolean or ${filters?.section??""}='events') then coalesce((
          select jsonb_agg(e) from (
            select e.id, e.organization_id,e.title, coalesce(e.starts_at::text,'') as starts_at, coalesce(e.ends_at::text,'') as ends_at, e.status_code,e.revision,e.location_text,e.location_type_code,
              exists(select 1 from lub.event_assets ea where ea.event_id=e.id and ea.asset_type_code='Poster') as has_poster,
              (select count(*)::int from lub.event_registrations r where r.event_id=e.id and r.status_code='Registered' and lub.is_counted_student(r.user_id)) as registrant_count
            from lub.events e where e.organization_id=o.id
              and (${!filters}::boolean or (${filters?.eventStatus??'all'}='all' and e.status_code<>'Archived') or e.status_code=${filters?.eventStatus??'all'})
              and position(lub.arabic_search_key(${filters?.eventSearch??''}) in lub.arabic_search_key(e.title||' '||coalesce(e.location_text,'')))>0
            order by (e.ends_at>=statement_timestamp()) desc nulls last,e.starts_at ${filters?.sort==='asc'?sql`asc`:sql`desc`} nulls last, e.id limit ${page===null?51:26} offset ${(page??0) * 25}
          ) e
        ), '[]'::jsonb) else '[]'::jsonb end as events,
        case when lub.has_event_access(o.id) then coalesce((
          select jsonb_agg(t) from (
            select t.id, t.name from lub.form_templates t
            where (t.organization_id=o.id or t.is_system_template)
              and exists(select 1 from lub.form_versions v where v.form_template_id=t.id and v.status_code='Published')
            order by t.name, t.id limit 100
          ) t
        ), '[]'::jsonb) else '[]'::jsonb end as templates,
        case when lub.has_org_permission(o.id, 'ORG_PROFILE_MANAGE') and (${!filters?.section}::boolean or ${filters?.section??''}='announcements') then coalesce((
          select jsonb_agg(a) from (
            select a.id, a.title, a.body, a.published_at is not null as published,
              a.pinned_at is not null as pinned, a.created_at as "createdAt",a.published_at as "publishedAt",a.archived_at is not null as archived,a.external_url as "externalUrl",a.image_asset_id as "imageAssetId"
            from lub.announcements a where a.organization_id=o.id and a.deleted_at is null
              and (${!filters}::boolean or (${filters?.announcementStatus??'all'}='all' and a.archived_at is null) or (${filters?.announcementStatus??'all'}='archived' and a.archived_at is not null) or (${filters?.announcementStatus??'all'}='published' and a.archived_at is null and a.published_at is not null) or (${filters?.announcementStatus??'all'}='draft' and a.archived_at is null and a.published_at is null))
              and position(lub.arabic_search_key(${filters?.announcementSearch??''}) in lub.arabic_search_key(a.title||' '||a.body))>0
            order by coalesce(a.published_at,a.created_at) ${filters?.announcementSort==='asc'?sql`asc`:sql`desc`}, a.id limit ${page===null?51:26} offset ${(filters?.announcementPage??0)*25}
          ) a
        ), '[]'::jsonb) else '[]'::jsonb end as announcements
      from lub.organizations o
      where o.id=${org} and (lub.has_event_access(o.id) or lub.has_org_permission(o.id, 'ORG_PROFILE_MANAGE'))
    `);
    return rows[0] as unknown as EventWorkspace | undefined;
  });
}

export async function publicEventPoster(id: string) {
  return withVisitor(async tx => {
    const rows = await tx.execute(sql`select p.*,lub.public_event_thumbnail(${id}) as thumbnail_png_base64 from lub.public_event_poster(${id}) p`);
    return rows[0] as { object_key: string; mime_type: string;thumbnail_png_base64?:string|null } | undefined;
  });
}

export async function privateEventPoster(user:string,id:string){return withUser(user,async tx=>{
 const rows=await tx.execute(sql`select a.object_key,a.mime_type,a.thumbnail_png_base64 from lub.events e join lub.event_assets ea on ea.event_id=e.id and ea.asset_type_code='Poster' join lub.application_assets a on a.id=ea.asset_id where e.id=${id} and lub.can_operate_event(e.id) limit 1`);
 return rows[0] as {object_key:string;mime_type:string;thumbnail_png_base64?:string|null}|undefined;
});}
