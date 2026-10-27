import Link from "next/link";
import { LubBrandName } from "@/components/lub-brand-name";
import { BadgeCheck, CalendarDays, Clock3, UsersRound } from "lucide-react";
import { academicLevel, formatCount, formatHours } from "@/lib/display";
import { formatRiyadhDate } from "@/lib/datetime";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription,
  EmptyContent,
} from "@/components/ui/empty";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationPrevious,
  PaginationNext,
} from "@/components/ui/pagination";
import { TalentContactLinks } from "./contact-links";
import { displaySkills, skillKey } from "./skill-normalization";
import type { PublicTalent, TalentCard, TalentPages } from "./repository";
import type { Locale } from "@/lib/preferences";

export function TalentPagination({
  pages,
  keyName,
  more,
  locale = "ar",
  from,
}: {
  pages: TalentPages;
  keyName: keyof TalentPages;
  more: boolean;
  locale?: Locale;
  from?: string;
}) {
  if (!pages[keyName] && !more) return null;
  const href = (page: number) =>
    `?${new URLSearchParams({ ...Object.fromEntries(Object.entries(pages).map(([k, v]) => [k, String(v)])), [keyName]: String(page), ...(from ? { from } : {}) })}`;
  return (
    <Pagination
      className="mt-4"
      aria-label={locale === "en" ? "Profile pages" : "صفحات الملف"}
    >
      <PaginationContent>
        {pages[keyName] > 0 && (
          <PaginationItem>
            <PaginationPrevious
              href={href(pages[keyName] - 1)}
              text={locale === "en" ? "Previous" : "السابق"}
              aria-label={locale === "en" ? "Previous page" : "الصفحة السابقة"}
            />
          </PaginationItem>
        )}
        {more && (
          <PaginationItem>
            <PaginationNext
              href={href(pages[keyName] + 1)}
              text={locale === "en" ? "Next" : "التالي"}
              aria-label={locale === "en" ? "Next page" : "الصفحة التالية"}
            />
          </PaginationItem>
        )}
      </PaginationContent>
    </Pagination>
  );
}
export function ApprovedHours({
  value,
  locale = "ar",
}: {
  value: string | number;
  locale?: Locale;
}) {
  return (
    <Tooltip>
      <TooltipTrigger render={<Badge variant="outline" tabIndex={0} />}>
        <BadgeCheck />
        {formatHours(value, locale)}{" "}
        {locale === "en"
          ? "approved"
          : Number(value) === 2
            ? "معتمدتان"
            : "معتمدة"}
      </TooltipTrigger>
      <TooltipContent>
        {locale === "en" ? (
          "Hours reviewed and approved through LUB. Role hours are included in the total; do not add them again."
        ) : (
          <>
            ساعات راجعتها واعتمدتها الجهة عبر <LubBrandName />. ساعات الأدوار
            جزء من الإجمالي ولا تُجمع معه مرة ثانية.
          </>
        )}
      </TooltipContent>
    </Tooltip>
  );
}

function OrganizationAvatar({
  name,
  logo,
}: {
  name: string;
  logo?: string | null;
}) {
  return (
    <Avatar size="sm" className="shrink-0">
      <AvatarImage src={logo ?? undefined} alt="" />
      <AvatarFallback>{name.trim().slice(0, 1)}</AvatarFallback>
    </Avatar>
  );
}
export function TalentCards({
  items,
  locale = "ar",
  returnTo = "/talent",
}: {
  items: TalentCard[];
  locale?: Locale;
  returnTo?: string;
}) {
  return (
    <ul className="grid items-stretch gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {items.map((t) => {
        const skills = displaySkills(t.skills);
        return (
          <li key={t.id} className="min-w-0">
            <Link
              href={`/talent/${t.id}?from=${encodeURIComponent(returnTo)}`}
              className="block h-full rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <Card className="h-full gap-4 transition-colors hover:bg-accent/40">
                <CardHeader className="flex min-h-16 flex-row items-center gap-3">
                  <Avatar size="lg">
                    {t.avatar_version && (
                      <AvatarImage
                        src={`/talent/${t.id}/avatar?v=${encodeURIComponent(t.avatar_version)}`}
                        alt=""
                      />
                    )}
                    <AvatarFallback>{t.name.trim().slice(0, 1)}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <h2 className="break-words font-semibold">
                      <bdi>{t.name}</bdi>
                    </h2>
                    <p className="text-sm text-muted-foreground">
                      <bdi>{t.major}</bdi> · {academicLevel(t.level, locale)}
                    </p>
                  </div>
                </CardHeader>
                <CardContent className="flex flex-1 flex-col gap-3">
                  <div className="min-h-7">
                    {Number(t.total) > 0 && (
                      <Badge variant="outline">
                        <Clock3 />
                        {formatHours(t.total!, locale)}{" "}
                        {locale === "en"
                          ? "approved"
                          : Number(t.total) === 2
                            ? "معتمدتان"
                            : "معتمدة"}
                      </Badge>
                    )}
                  </div>
                  <div className="flex min-h-10 flex-wrap content-start items-start gap-2">
                    {skills.slice(0, 4).map((s) => (
                      <Badge key={skillKey(s)} variant="secondary">
                        <bdi>{s}</bdi>
                      </Badge>
                    ))}
                    {skills.length > 4 && (
                      <Badge variant="outline">
                        <bdi>+{skills.length - 4}</bdi>
                      </Badge>
                    )}
                  </div>
                </CardContent>
                <CardFooter className="min-h-10 gap-2 border-border">
                  {t.organizations?.slice(0, 4).map((o) => (
                    <span key={o.slug} title={o.name} aria-label={o.name}>
                      <OrganizationAvatar name={o.name} logo={o.logo} />
                    </span>
                  ))}
                  {(t.organizations?.length ?? 0) > 4 && (
                    <span className="text-sm text-muted-foreground">
                      <bdi>+{t.organizations!.length - 4}</bdi>
                    </span>
                  )}
                </CardFooter>
              </Card>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
export function TalentEmpty({
  filtered,
  en,
}: {
  filtered: boolean;
  en: boolean;
}) {
  return (
    <Empty>
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <UsersRound />
        </EmptyMedia>
        <EmptyTitle>
          {en
            ? filtered
              ? "No matching profiles"
              : "No published talent yet"
            : filtered
              ? "لا توجد نتائج مطابقة"
              : "لا توجد مواهب منشورة بعد"}
        </EmptyTitle>
        <EmptyDescription>
          {en
            ? filtered
              ? "Try fewer filters or a different search."
              : "Published student profiles will appear here."
            : filtered
              ? "جرّب تقليل الفلاتر أو تغيير كلمات البحث."
              : "تظهر هنا الملفات التي يختار الطلاب نشرها."}
        </EmptyDescription>
      </EmptyHeader>
      {filtered && (
        <EmptyContent>
          <Button
            nativeButton={false}
            variant="outline"
            render={<Link href="/talent" />}
          >
            {en ? "Clear search" : "مسح البحث"}
          </Button>
        </EmptyContent>
      )}
    </Empty>
  );
}
function roleLabel(code: string, type: string | undefined, en: boolean) {
  if (en)
    return (
      (
        {
          OL: type === "Council" ? "Council leader" : "Club leader",
          OD: "Deputy leader",
          CL: "Committee leader",
          CD: "Deputy committee leader",
        } as Record<string, string>
      )[code] ?? "Member"
    );
  return (
    (
      {
        OL: type === "Council" ? "قائد المجلس" : "قائد النادي",
        OD: type === "Council" ? "نائب قائد المجلس" : "نائب قائد النادي",
        CL: "قائد اللجنة",
        CD: "نائب قائد اللجنة",
      } as Record<string, string>
    )[code] ?? "عضو"
  );
}
function OwnerPrompt({
  children,
  href = "/account/talent",
}: {
  children: React.ReactNode;
  href?: string;
}) {
  return (
    <Button
      nativeButton={false}
      variant="ghost"
      size="sm"
      render={<Link href={href} />}
    >
      {children}
    </Button>
  );
}
export function PublicTalentView({
  profile: p,
  pages,
  locale = "ar",
  owner = false,
  from = "/talent",
}: {
  profile: PublicTalent;
  pages: TalentPages;
  locale?: Locale;
  owner?: boolean;
  from?: string;
}) {
  const en = locale === "en",
    c = (ar: string, english: string) => (en ? english : ar),
    skills = displaySkills(p.skills);
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Riyadh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  const grouped = (past: boolean) =>
    p.organizations
      .slice(0, 25)
      .map((o) => ({
        ...o,
        memberships: o.memberships.filter(
          (m) =>
            (m.status_code !== "Active" ||
              (!!m.end_date && m.end_date <= today)) === past,
        ),
      }))
      .filter((o) => o.memberships.length);
  const current = grouped(false),
    previous = grouped(true);
  return (
    <div
      className="mx-auto flex w-full max-w-4xl min-w-0 flex-col gap-5"
    >
      <aside className="min-w-0">
        <Card>
          <CardHeader className="flex flex-row items-center gap-4">
            <Avatar className="size-20 shrink-0">
              {p.avatar_version && (
                <AvatarImage
                  src={`/talent/${p.id}/avatar?v=${encodeURIComponent(p.avatar_version)}`}
                  alt=""
                />
              )}
              <AvatarFallback>{p.name.trim().slice(0, 1)}</AvatarFallback>
            </Avatar>
            <div className="flex min-w-0 flex-1 flex-col items-start gap-2">
            <h1 className="break-words text-2xl font-semibold">
              <bdi>{p.name}</bdi>
            </h1>
            <p className="text-muted-foreground">
              <bdi>{p.major}</bdi> · {academicLevel(p.level, locale)}
            </p>
            {Number(p.total) > 0 && (
              <ApprovedHours value={p.total!} locale={locale} />
            )}
            </div>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {skills.length > 0 ? (
              <div
                className="flex flex-wrap gap-2"
                aria-label={c("المهارات", "Skills")}
              >
                {skills.map((s) => (
                  <Badge
                    key={skillKey(s)}
                    variant="secondary"
                    render={
                      <Link
                        href={`/talent?skill=${encodeURIComponent(skillKey(s))}`}
                      />
                    }
                  >
                    <bdi>{s}</bdi>
                  </Badge>
                ))}
              </div>
            ) : (
              owner && (
                <OwnerPrompt>{c("أضف مهاراتك", "Add your skills")}</OwnerPrompt>
              )
            )}
            {p.links.length > 0 && (
              <TalentContactLinks links={p.links} en={en} />
            )}
          </CardContent>
          <CardFooter className="grid grid-cols-3 items-center gap-3 border-t border-border pt-4 text-center">
            {[{value:p.total??0,unit:"hours"},{value:p.stats?.organizations??p.organizations.length,unit:"organizations"},{value:p.stats?.events??p.events.length,unit:"events"}].map(stat=><p key={stat.unit} className="font-medium">{formatCount(stat.value,stat.unit as "hours"|"organizations"|"events",locale,"nominative","number")}</p>)}
          </CardFooter>
        </Card>
      </aside>
      <div className="flex min-w-0 flex-col gap-5">
        {p.bio ? (
          <Card>
            <CardHeader>
              <CardTitle>{c("نبذة", "About")}</CardTitle>
            </CardHeader>
            <CardContent>
              <p
                className="whitespace-pre-wrap break-words leading-relaxed"
                dir="auto"
              >
                {p.bio}
              </p>
            </CardContent>
          </Card>
        ) : (
          owner && (
            <OwnerPrompt>{c("أضف نبذة عنك", "Add your bio")}</OwnerPrompt>
          )
        )}
        {p.organizations.length > 0 ? (
          <Card>
            <CardHeader>
              <CardTitle>
                {c("العضويات والأدوار", "Memberships and roles")}
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-5">
              {[
                { items: current, title: c("الحالية", "Current") },
                { items: previous, title: c("السابقة", "Previous") },
              ]
                .filter((g) => g.items.length)
                .map((g) => (
                  <section key={g.title} className="flex flex-col gap-3">
                    {previous.length > 0 && (
                      <h3 className="font-medium text-muted-foreground">
                        {g.title}
                      </h3>
                    )}
                    <ul className="divide-y divide-border">
                      {g.items.map((o) => {
                        const joined = o.memberships
                          .map((m) => m.start_date)
                          .sort()[0];
                        return (
                          <li
                            key={o.slug}
                            className="flex flex-col gap-3 py-4 first:pt-0 last:pb-0"
                          >
                            <div className="flex flex-wrap items-center gap-3">
                              <div className="min-w-0 flex-1">
                                <Link
                                  className="font-semibold hover:text-primary"
                                  href={`/organizations/${o.slug}`}
                                >
                                  <bdi>{o.name}</bdi>
                                </Link>
                                <p className="text-sm text-muted-foreground">
                                  {c("عضو منذ", "Member since")}{" "}
                                  {formatRiyadhDate(joined, locale)}
                                </p>
                              </div>
                              {Number(o.hours) > 0 && (
                                <span className="text-sm text-muted-foreground">
                                  {c("إجمالي الجهة:", "Organization total:")}{" "}
                                  {formatHours(o.hours!, locale)}
                                </span>
                              )}
                            </div>
                            <div className="flex flex-wrap items-center gap-2">
                              {o.memberships.map((m, index) =>
                                m.roles.length ? (
                                  m.roles.map((r, ri) => (
                                    <div
                                      key={`${index}-${ri}`}
                                      className="flex flex-wrap items-center gap-2"
                                    >
                                      <Badge
                                        variant={
                                          r.code === "OL" || r.code === "CL"
                                            ? "default"
                                            : "secondary"
                                        }
                                      >
                                        {roleLabel(r.code, o.type, en)}
                                      </Badge>
                                      {r.hours !== undefined && (
                                        <span className="text-sm text-muted-foreground">
                                          {c("ساعات الدور:", "Role hours:")}{" "}
                                          {formatHours(r.hours, locale)}
                                        </span>
                                      )}
                                      {r.ends && (
                                        <span className="text-sm text-muted-foreground">
                                          {c("حتى", "Until")}{" "}
                                          {formatRiyadhDate(r.ends, locale)}
                                        </span>
                                      )}
                                    </div>
                                  ))
                                ) : (
                                  <Badge key={index} variant="secondary">
                                    {c("عضو", "Member")}
                                  </Badge>
                                ),
                              )}
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  </section>
                ))}
              <TalentPagination
                pages={pages}
                keyName="organizations"
                more={p.organizations.length > 25}
                locale={locale}
                from={from}
              />
            </CardContent>
          </Card>
        ) : (
          owner && (
            <OwnerPrompt href="/organizations">
              {c(
                "اكتشف الجهات وابدأ مشاركتك",
                "Discover organizations and get involved",
              )}
            </OwnerPrompt>
          )
        )}
        {p.events.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>
                {c("الحضور والمساهمات", "Attendance and contributions")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="divide-y divide-border">
                {p.events.slice(0, 25).map((e) => (
                  <li
                    key={e.href}
                    className="flex flex-col gap-2 py-3 first:pt-0 last:pb-0"
                  >
                    <Link
                      href={e.href}
                      className="flex items-center gap-2 font-medium hover:text-primary"
                    >
                      <CalendarDays />
                      <bdi>{e.title}</bdi>
                    </Link>
                    <p className="text-sm text-muted-foreground">
                      <bdi>{e.organization}</bdi> ·{" "}
                      {formatRiyadhDate(e.starts_at, locale)}
                    </p>
                    {e.contributions.map((v, i) => (
                      <Badge key={i} variant="secondary">
                        <bdi>{v.title}</bdi>
                      </Badge>
                    ))}
                  </li>
                ))}
              </ul>
              <TalentPagination
                pages={pages}
                keyName="events"
                more={p.events.length > 25}
                locale={locale}
                from={from}
              />
            </CardContent>
          </Card>
        )}
        {p.projects.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>{c("الإنجازات", "Achievements")}</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="flex flex-col gap-4">
                {p.projects.slice(0, 25).map((x) => (
                  <li key={x.id}>
                    <h3 className="font-semibold" dir="auto">
                      {x.title}
                    </h3>
                    <p
                      className="whitespace-pre-wrap leading-relaxed text-muted-foreground"
                      dir="auto"
                    >
                      {x.description}
                    </p>
                  </li>
                ))}
              </ul>
              <TalentPagination
                pages={pages}
                keyName="projects"
                more={p.projects.length > 25}
                locale={locale}
                from={from}
              />
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
