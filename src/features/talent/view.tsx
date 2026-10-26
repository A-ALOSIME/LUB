import { academicLevel, formatHours } from "@/lib/display";
import Link from "next/link";
import { Award, CalendarDays, Clock3, GraduationCap, MapPin, UsersRound } from "lucide-react";
import type { PublicTalent, TalentCard, TalentPages } from "./repository";
import { eventDay, eventDayEn, eventLabels, eventLabelsEn } from "@/features/events/display";
import type { Locale } from "@/lib/preferences";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TalentContactLinks } from "./contact-links";
import { displaySkills } from "./skill-normalization";
import { Button } from "@/components/ui/button";

const roleLabels: Record<string, string> = { OL: "قائد الجهة", OD: "نائب القائد", CL: "قائد اللجنة", CD: "نائب قائد اللجنة" };
const roleLabelsEn: Record<string, string> = { OL: "Organization leader", OD: "Deputy leader", CL: "Committee leader", CD: "Deputy committee leader" };

export function TalentPagination({ pages, keyName, more, locale = "ar" }: { pages: TalentPages; keyName: keyof TalentPages; more: boolean; locale?: Locale }) {
  const en = locale === "en";
  const href = (page: number) => `?${new URLSearchParams({ ...Object.fromEntries(Object.entries(pages).map(([key, value]) => [key, String(value)])), [keyName]: String(page) })}`;
  return <nav className="mt-4 flex gap-5 text-sm" aria-label={en ? `${keyName} pages` : `صفحات ${keyName}`}>
    {pages[keyName] > 0 && <Link className="text-link" href={href(pages[keyName] - 1)}>{en ? "Previous" : "السابق"}</Link>}
    {more && <Link className="text-link" href={href(pages[keyName] + 1)}>{en ? "Next" : "التالي"}</Link>}
  </nav>;
}

export function TalentCards({ items, locale = "ar" }: { items: TalentCard[]; locale?: Locale }) {
  const en = locale === "en";
  return items.length ? <ul className="grid gap-4 sm:grid-cols-2">{items.map(talent => {
    const skills = displaySkills(talent.skills);
    return <li key={talent.id}><Link href={`/talent/${talent.id}`} className="block h-full rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-ring">
      <Card size="sm" className="h-full min-w-0 transition-colors hover:bg-accent/50">
        <CardContent className="grid min-w-0 gap-3">
          <div className="flex items-center gap-3"><Avatar size="lg">{talent.avatar_version && <AvatarImage src={avatarUrl(talent)} alt=""/>}<AvatarFallback>{talent.name.trim().slice(0,1)}</AvatarFallback></Avatar><div className="min-w-0"><h2 className="break-words text-lg font-semibold">{talent.name}</h2><p className="text-sm text-muted-foreground">{talent.major}{talent.level && <> · {academicLevel(talent.level,locale)}</>}</p></div></div>
          {Number(talent.total)>0 && <Badge variant="outline"><Clock3/>{hoursLabel(talent.total!,en)}</Badge>}
          {skills.length>0 && <div className="flex flex-wrap gap-2">{skills.slice(0,5).map(skill=><Badge key={skill} variant="secondary" dir="auto">{skill}</Badge>)}{skills.length>5&&<Badge variant="outline" dir="ltr">+{skills.length-5}</Badge>}</div>}
        </CardContent>
      </Card>
    </Link></li>;
  })}</ul> : <div className="space-y-3 py-8 text-center"><p className="text-muted-foreground">{en ? "No matching published talent profiles." : "لا توجد ملفات مهارية مطابقة."}</p><Button nativeButton={false} variant="outline" render={<Link href="/talent"/>}>{en?"Clear search":"مسح البحث"}</Button></div>;
}

function avatarUrl(profile: TalentCard) { return `/talent/${profile.id}/avatar?v=${encodeURIComponent(profile.avatar_version ?? "")}`; }

function formatDate(value: string, en: boolean) {
  return (en ? eventDayEn : eventDay)(value);
}

function hoursLabel(value: string, en: boolean) {
  return en?`${formatHours(value,"en")} approved`:`${formatHours(value)} ${Number(value)===2?"معتمدتان":"معتمدة"}`;
}

function PublicSection({ title, children, icon }: { title: string; children: React.ReactNode; icon: React.ReactNode }) {
  return <Card size="sm" className="min-w-0">
    <CardHeader className="grid-cols-[auto_minmax(0,1fr)] items-center gap-3">
      <span className="grid size-9 place-items-center rounded-lg bg-primary text-primary-foreground">{icon}</span>
      <CardTitle>{title}</CardTitle>
    </CardHeader>
    <CardContent className="min-w-0">{children}</CardContent>
  </Card>;
}

export function PublicTalentView({ profile: p, pages, locale = "ar" }: { profile: PublicTalent; pages: TalentPages; locale?: Locale }) {
  const en = locale === "en";
  const labels = en ? eventLabelsEn : eventLabels;
  const roles = en ? roleLabelsEn : roleLabels;
  const firstInitial = p.name.trim().normalize("NFC").slice(0, 1) || (en ? "S" : "ط");
  const level = academicLevel(p.level,locale);
  const skills = displaySkills(p.skills);
  const total = p.total !== null && Number(p.total) > 0 ? p.total : null;

  return <div dir={en?"ltr":"rtl"} className="grid min-w-0 gap-4">
    <Card className="min-w-0">
      <CardContent className="grid min-w-0 gap-4 p-4 sm:grid-cols-[auto_minmax(0,1fr)] sm:items-start sm:p-5">
        <Avatar size="lg" className="size-14 sm:size-16">
          {p.avatar_version && <AvatarImage src={avatarUrl(p)} alt=""/>}
          <AvatarFallback className="bg-primary text-xl font-semibold text-primary-foreground sm:text-2xl">{firstInitial}</AvatarFallback>
        </Avatar>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center justify-between gap-3"><h1 dir="auto" className="break-words text-2xl font-bold leading-tight sm:text-3xl">{p.name}</h1>{total && <Badge variant="outline"><Clock3/>{hoursLabel(total,en)}</Badge>}</div>
          <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
            <span className="inline-flex min-w-0 items-center gap-1.5"><GraduationCap aria-hidden="true" className="size-4 shrink-0" /><bdi dir="auto">{p.major}</bdi></span>
            <span>{level}</span>
          </p>

          {p.bio && <p dir="auto" className="mt-4 whitespace-pre-wrap break-words text-sm leading-7 text-muted-foreground">{p.bio}</p>}
          {skills.length > 0 ? <div className="mt-4 flex flex-wrap gap-2" aria-label={en ? "Published skills" : "المهارات المنشورة"}>
            {skills.map((skill) => <Badge key={skill} variant="secondary" dir="auto" className="h-auto max-w-full whitespace-normal px-2.5 py-1 text-xs">{skill}</Badge>)}
          </div> : <p className="mt-3 text-sm text-muted-foreground">{en?"No published skills.":"لا توجد مهارات منشورة."}</p>}
          {p.links.length > 0 && <TalentContactLinks links={p.links} en={en}/>}
          {!total && <p className="mt-3 text-sm text-muted-foreground">{en?"No approved hours yet.":"لا توجد ساعات معتمدة بعد."}</p>}
        </div>
      </CardContent>
    </Card>

    {p.organizations.length > 0 && <PublicSection title={en ? "Memberships and roles" : "العضويات والأدوار"} icon={<UsersRound aria-hidden="true" className="size-4" />}>
      <ul className="divide-y divide-border">
        {p.organizations.slice(0, 25).map(organization => {
          const memberships=organization.memberships;
          const joined=memberships.map(m=>m.start_date).sort()[0];
          const codes=[...new Set(memberships.flatMap(m=>m.roles.map(r=>r.code)))];
          return <li key={organization.id} className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
            <div className="min-w-0 space-y-2"><div className="flex flex-wrap items-center gap-2"><Link dir="auto" href={`/organizations/${organization.slug}`} className="font-medium hover:text-primary">{organization.name}</Link>{organization.archived && <Badge variant="outline">{en?"Archived":"مؤرشفة"}</Badge>}{codes.length?codes.map(code=><Badge key={code} variant="secondary">{roles[code]??code}</Badge>):<Badge variant="secondary">{en?"Member":"عضو"}</Badge>}</div>{joined&&<p className="text-sm text-muted-foreground">{en?"Member since":"عضو منذ"} {formatDate(joined,en)}</p>}</div>
            {Number(organization.hours)>0 && <span className="text-sm text-muted-foreground">{hoursLabel(organization.hours!,en)}</span>}
          </li>;
        })}
      </ul>
      <TalentPagination pages={pages} keyName="organizations" more={p.organizations.length > 25} locale={locale} />
    </PublicSection>}
    {!p.organizations.length && <p className="text-sm text-muted-foreground">{en?"No published memberships.":"لا توجد عضويات منشورة."}</p>}

    {p.events.length > 0 && <PublicSection title={en ? "Attendance and contributions" : "الحضور والمساهمات"} icon={<CalendarDays aria-hidden="true" className="size-4" />}>
      <ul className="divide-y divide-border">
        {p.events.slice(0, 25).map((event) => <li key={event.id} className="py-3 first:pt-0 last:pb-0">
          <div className="flex min-w-0 flex-wrap items-start justify-between gap-2">
            <Link dir="auto" className="min-w-0 break-words font-medium text-primary underline-offset-4 hover:underline" href={`/events/${event.id}`}>{event.title}</Link>
            {event.attendance && <Badge variant="outline" className="shrink-0">{labels[event.attendance] ?? event.attendance}</Badge>}
          </div>
          <p className="mt-1 flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1"><MapPin aria-hidden="true" className="size-3.5" /><bdi>{event.organization}</bdi></span>
            {event.archived && <span>{en ? "Archived organization" : "جهة مؤرشفة"}</span>}
            <span>{formatDate(event.starts_at, en)}</span>
          </p>
          {event.contributions.length > 0 && <ul className="mt-2 flex flex-wrap gap-2">
            {event.contributions.map((contribution, index) => <li key={`${contribution.kind}-${index}`}><Badge variant="secondary" className="h-auto max-w-full whitespace-normal py-1">{labels[contribution.kind] ?? contribution.kind} · <bdi dir="auto">{contribution.title}</bdi></Badge></li>)}
          </ul>}
        </li>)}
      </ul>
      <TalentPagination pages={pages} keyName="events" more={p.events.length > 25} locale={locale} />
    </PublicSection>}

    {p.projects.length > 0 && <PublicSection title={en ? "Achievements" : "الإنجازات"} icon={<Award aria-hidden="true" className="size-4" />}>
      <ul className="divide-y divide-border">
        {p.projects.slice(0, 25).map((achievement) => <li key={achievement.id} className="py-3 first:pt-0 last:pb-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 dir="auto" className="min-w-0 break-words font-medium">{achievement.title}</h3>
            {achievement.featured && <Badge variant="outline">{en ? "Featured" : "مثبت"}</Badge>}
          </div>
          {achievement.description && <p dir="auto" className="mt-1 whitespace-pre-wrap break-words text-sm leading-6 text-muted-foreground">{achievement.description}</p>}
        </li>)}
      </ul>
      <TalentPagination pages={pages} keyName="projects" more={p.projects.length > 25} locale={locale} />
    </PublicSection>}
  </div>;
}
