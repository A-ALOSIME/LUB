import { formatHours } from "@/lib/display";
import Link from "next/link";
import { Award, CalendarDays, Clock3, GraduationCap, MapPin, UsersRound } from "lucide-react";
import type { PublicTalent, TalentCard, TalentPages } from "./repository";
import { eventDay, eventDayEn, eventLabels, eventLabelsEn } from "@/features/events/display";
import type { Locale } from "@/lib/preferences";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TalentChannelIcon, talentChannelLabel } from "./contact-channel";

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
  return items.length ? <ul className="grid gap-4 sm:grid-cols-2">{items.map((talent) => <li key={talent.id}>
    <Card size="sm" className="h-full min-w-0">
      <CardHeader>
        <CardTitle className="text-lg"><Link href={`/talent/${talent.id}`} className="text-link">{talent.name}</Link></CardTitle>
        <p dir="auto" className="text-sm text-muted-foreground">{talent.major}</p>
      </CardHeader>
      <CardContent className="min-w-0">
        {talent.bio && <p dir="auto" className="line-clamp-3 break-words leading-7 text-muted-foreground">{talent.bio}</p>}
        {talent.skills.length > 0 && <ul className="mt-3 flex flex-wrap gap-2" aria-label={en ? "Published skills" : "المهارات المنشورة"}>{talent.skills.map((skill) => <li key={skill} dir="auto" className="rounded-full bg-muted px-2.5 py-1 text-xs">{skill}</li>)}</ul>}
      </CardContent>
    </Card>
  </li>)}</ul> : <p className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">{en ? "No matching published talent profiles right now." : "لا توجد ملفات مهارية منشورة مطابقة الآن."}</p>;
}

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
  const level = en ? p.level === "graduate" ? "Graduate" : `Level ${p.level}` : p.level === "graduate" ? "خريج" : `المستوى ${p.level}`;
  const total = p.total !== null && Number(p.total) > 0 ? p.total : null;

  return <div dir="rtl" className="grid min-w-0 gap-4">
    <Card className="min-w-0">
      <CardContent className="grid min-w-0 gap-4 p-4 sm:grid-cols-[auto_minmax(0,1fr)] sm:items-start sm:p-5">
        <Avatar size="lg" className="size-14 sm:size-16">
          <AvatarFallback className="bg-primary text-xl font-semibold text-primary-foreground sm:text-2xl">{firstInitial}</AvatarFallback>
        </Avatar>
        <div className="min-w-0">
          <h1 dir="auto" className="break-words text-2xl font-bold leading-tight sm:text-3xl">{p.name}</h1>
          <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
            <span className="inline-flex min-w-0 items-center gap-1.5"><GraduationCap aria-hidden="true" className="size-4 shrink-0" /><bdi dir="auto">{p.major}</bdi></span>
            <span>{level}</span>
          </p>
          {total && <Badge variant="outline" className="mt-3 h-7 gap-1.5 px-2.5 text-sm font-medium"><Clock3 aria-hidden="true" />{hoursLabel(total, en)}</Badge>}
          {p.bio && <p dir="auto" className="mt-4 whitespace-pre-wrap break-words text-sm leading-7 text-muted-foreground">{p.bio}</p>}
          {p.skills.length > 0 && <div className="mt-4 flex flex-wrap gap-2" aria-label={en ? "Published skills" : "المهارات المنشورة"}>
            {p.skills.map((skill) => <Badge key={skill} variant="secondary" dir="auto" className="h-auto max-w-full whitespace-normal px-2.5 py-1 text-xs">{skill}</Badge>)}
          </div>}
          {p.links.length > 0 && <nav className="mt-4 flex flex-wrap gap-2" aria-label={en ? "Published contact channels" : "قنوات التواصل المنشورة"}>
            {p.links.map((link, index) => {
              const href = link.kind === "Email" ? `mailto:${link.value}` : link.kind === "Phone" ? `tel:${link.value}` : link.value;
              const label = talentChannelLabel(link.kind, en);
              return <a key={`${link.kind}-${index}`} href={href} rel="noopener noreferrer" aria-label={label} title={label} className="organization-contact-icon transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
                <TalentChannelIcon kind={link.kind} className="size-4 shrink-0" />
              </a>;
            })}
          </nav>}
        </div>
      </CardContent>
    </Card>

    {p.organizations.length > 0 && <PublicSection title={en ? "Memberships and roles" : "العضويات والأدوار"} icon={<UsersRound aria-hidden="true" className="size-4" />}>
      <ul className="divide-y divide-border">
        {p.organizations.slice(0, 25).map((organization) => <li key={organization.id} className="py-3 first:pt-0 last:pb-0">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Link dir="auto" href={`/organizations/${organization.slug}`} className="font-medium text-primary underline-offset-4 hover:underline">{organization.name}</Link>
            {organization.archived && <Badge variant="outline">{en ? "Archived" : "مؤرشفة"}</Badge>}
          </div>
          {organization.hours !== null && Number(organization.hours) > 0 && <p className="mt-1 text-xs text-muted-foreground">{hoursLabel(organization.hours, en)}</p>}
          <ul className="mt-2 flex flex-col gap-2">
            {organization.memberships.map((membership, membershipIndex) => <li key={`${membership.start_date}-${membershipIndex}`} className="text-sm">
              <p className="text-muted-foreground">
                {membership.end_date
                  ? `${en ? "Member from" : "عضو من"} ${formatDate(membership.start_date, en)} ${en ? "to" : "حتى"} ${formatDate(membership.end_date, en)}`
                  : `${en ? "Member since" : "عضو منذ"} ${formatDate(membership.start_date, en)}`}
              </p>
              {membership.roles.length > 0 && <ul className="mt-1 flex flex-col gap-1 border-s-2 border-border ps-3">
                {membership.roles.map((role, roleIndex) => <li key={`${role.code}-${role.starts}-${roleIndex}`} className="flex flex-wrap gap-x-2 text-sm">
                  <span className="font-medium">{roles[role.code] ?? role.code}</span>
                  <span className="text-muted-foreground">{formatDate(role.starts, en)}{role.ends ? ` ${en ? "to" : "إلى"} ${formatDate(role.ends, en)}` : ""}</span>
                </li>)}
              </ul>}
            </li>)}
          </ul>
        </li>)}
      </ul>
      <TalentPagination pages={pages} keyName="organizations" more={p.organizations.length > 25} locale={locale} />
    </PublicSection>}

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
