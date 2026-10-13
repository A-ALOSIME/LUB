import { localizedMetadata } from "@/lib/localized-metadata";
import Link from "next/link";
import { redirect } from "next/navigation";
import { requireStudentUser as requireUser } from "@/features/auth/authorization";
import { getMyPageData } from "@/features/organizations/my-page-repository";
import { StorageUnavailable } from "@/components/storage-unavailable";
import { isProfileStorageConfigured } from "@/lib/env";
import { taskLabels } from "@/features/tasks/repository";
import { taskLabelsEn } from "@/features/tasks/display";
import { getPreferences } from "@/lib/preferences";
import { formatPersonalDate, formatPersonalNumber } from "@/features/organizations/personal-display";

export async function generateMetadata() { return localizedMetadata("صفحتي", "My page"); }

export default async function MyPage({ searchParams }: { searchParams: Promise<{ notice?: string }> }) {
  const preferences = await getPreferences();
  const locale = preferences.locale;
  const en = locale === "en";
  const user = await requireUser();

  if (!isProfileStorageConfigured()) return <StorageUnavailable />;

  const { status, profile, memberships, tasks, hours } = await getMyPageData(user.id);
  if (status === "Inactive") redirect("/account-unavailable");
  if (!profile) redirect("/onboarding");

  const roleLabels: Record<string, string> = en
    ? { OL: "Organization leader", OD: "Deputy leader", CL: "Committee leader", CD: "Deputy committee leader" }
    : { OL: "قائد الجهة", OD: "نائب القائد", CL: "قائد اللجنة", CD: "نائب قائد اللجنة" };
  const formatDate = (value: string) => formatPersonalDate(value, locale);
  const formatNumber = (value: number | string) => formatPersonalNumber(value, locale);
  const { notice } = await searchParams;
  const activeMemberships = memberships.filter(membership => membership.statusCode === "Active").length;

  return <main id="main" className="workspace-content my-page-content min-w-0">
      {notice === "profile-saved" && <p role="status" className="notice-success mb-6 rounded-lg border border-green-200 bg-green-50 p-4 text-action">{en ? "Your details were saved." : "تم حفظ بياناتك."}</p>}
      {notice === "signout-failed" && <p role="alert" className="error-message mb-6">{en ? "Could not sign out. Please try again." : "تعذّر تسجيل الخروج. حاول مرة ثانية."}</p>}

          <header id="overview" className="workspace-hero workspace-my-page-hero scroll-mt-6">
            <div className="workspace-my-page-copy">
              <p className="workspace-my-page-kicker">
                <span aria-hidden="true" className="workspace-my-page-kicker-mark" />
                {en ? "YOUR LUB WORKSPACE" : "مساحتك في لُبّ"}
              </p>
              <h1 className="mt-4 text-3xl font-bold leading-tight sm:text-4xl">{en ? "Hello, " : "أهلًا، "}<bdi>{profile.fullName}</bdi></h1>
              <p className="mt-3 max-w-3xl leading-8 text-muted">{en ? "Your account, activity and organization management now share one workspace." : "حسابك ومشاركاتك وإدارة الجهات التي تملك صلاحيتها، كلها في مساحة واحدة."}</p>
            </div>
          </header>

          <section aria-label={en ? "Account summary" : "ملخص الحساب"} className="workspace-summary-grid">
            <SummaryItem icon="memberships" label={en ? "Active memberships" : "عضويات نشطة"} value={formatNumber(activeMemberships)} />
            <SummaryItem icon="tasks" label={en ? "Current tasks" : "مشاركات حالية"} value={formatNumber(tasks.length)} />
            <SummaryItem icon="hours" label={en ? "Approved hours" : "ساعات معتمدة"} value={formatNumber(hours)} />
          </section>

          <section id="memberships" aria-labelledby="memberships-title" className="workspace-panel workspace-my-page-section workspace-my-page-section--memberships scroll-mt-6">
            <SectionHeading id="memberships-title" eyebrow={en ? "ORGANIZATIONS" : "العضويات والأدوار"} title={en ? "Memberships and role history" : "عضوياتي وسجل أدواري"} />
            {memberships.length ? <ul className="mt-4 divide-y divide-line">
              {memberships.map(membership => <li key={membership.id} className="py-4 first:pt-1 last:pb-1">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <Link href={`/organizations/${membership.slug}`} dir="auto" className="text-lg font-semibold text-action hover:underline">{membership.organizationName}</Link>
                  <span className="rounded-full border border-line px-3 py-1 text-xs font-semibold text-muted">{en ? membership.statusCode === "Active" ? "Active" : membership.statusCode === "Inactive" ? "Inactive" : "Ended" : membership.statusCode === "Active" ? "نشطة" : membership.statusCode === "Inactive" ? "غير نشطة" : "منتهية"}</span>
                </div>
                {membership.organizationStatus === "Archived" && <p className="mt-1 text-sm text-muted">{en ? "Organization archived" : "الجهة مؤرشفة"}</p>}
                <p className="mt-2 text-sm leading-7 text-muted">{en ? "From " : "من "}{formatDate(membership.startDate)}{membership.endDate && <> {en ? "to" : "إلى"} {formatDate(membership.endDate)}</>}</p>
                {membership.roles.length > 0 && <ul className="mt-3 space-y-2 border-s-2 border-line ps-4 text-sm leading-7">
                  {membership.roles.map((role, index) => <li key={`${role.code}-${role.startDate}-${index}`}><span className="font-semibold">{roleLabels[role.code]}</span><span className="text-muted"> · {en ? "from" : "من"} {formatDate(role.startDate)}{role.endDate ? <> {en ? "to" : "إلى"} {formatDate(role.endDate)}</> : en ? ", ongoing" : "، مستمر"}</span></li>)}
                </ul>}
              </li>)}
            </ul> : <p className="mt-4 leading-7 text-muted">{en ? "Your membership history will appear here when it is available." : "يظهر سجل عضوياتك هنا عند توفره."}</p>}
          </section>

          <section id="tasks" aria-labelledby="tasks-title" className="workspace-panel workspace-my-page-section workspace-my-page-section--tasks scroll-mt-6">
            <SectionHeading id="tasks-title" eyebrow={en ? "PARTICIPATION" : "المشاركة"} title={en ? "Current tasks" : "مشاركاتي الحالية"} />
            {tasks.length ? <ul className="mt-4 divide-y divide-line">{tasks.map(task => <li key={task.id} className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-1 last:pb-1"><Link dir="auto" className="font-semibold text-action hover:underline" href={`/tasks/${task.id}`}>{task.title}</Link><span className="text-sm text-muted">{en ? taskLabelsEn[task.status] : taskLabels[task.status]}</span></li>)}</ul> : <p className="mt-4 leading-7 text-muted">{en ? "No current task participation to show." : "لا توجد مشاركات حالية لعرضها الآن."}</p>}
            <Link className="mt-4 inline-block text-sm font-semibold text-action hover:underline" href="/tasks">{en ? "Tasks and participation history" : "المهام وسجل المشاركات"}<span aria-hidden="true" className="ms-2">←</span></Link>
          </section>

          <section id="events" aria-labelledby="events-title" className="workspace-panel workspace-my-page-section workspace-my-page-section--events scroll-mt-6">
            <SectionHeading id="events-title" eyebrow={en ? "EVENTS" : "الفعاليات"} title={en ? "My events" : "فعالياتي"} />
            <p className="mt-3 leading-7 text-muted">{en ? "Your registrations and attendance are saved in your event history." : "تسجيلاتي وحضوري محفوظان في سجل الفعاليات."}</p>
            <Link href="/events/mine" className="mt-4 inline-block text-sm font-semibold text-action hover:underline">{en ? "View my events" : "عرض فعالياتي"}<span aria-hidden="true" className="ms-2">←</span></Link>
          </section>
  </main>;
}

function SummaryItem({ icon, label, value }: { icon: "memberships" | "tasks" | "hours"; label: string; value: string }) {
  return <div className="workspace-summary-item">
    <span aria-hidden="true" className="workspace-summary-icon">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.7">
        {icon === "memberships" && <><circle cx="9" cy="8" r="3" /><path d="M3.5 20v-1.5a5.5 5.5 0 0 1 11 0V20zM17 8h4m-2-2v4M17 15h4" /></>}
        {icon === "tasks" && <><rect x="4" y="4" width="16" height="17" rx="2" /><path d="M8 9h8M8 13h8m-8 4h5M9 4V2m6 2V2" /></>}
        {icon === "hours" && <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3.5 2" /></>}
      </svg>
    </span>
    <span className="workspace-summary-main"><span className="workspace-summary-caption">{label}</span><strong className="text-3xl font-extrabold tabular-nums">{value}</strong></span>
  </div>;
}

function SectionHeading({ id, eyebrow, title }: { id: string; eyebrow: string; title: string }) {
  return <div className="workspace-section-title">
    <p className="text-xs font-semibold tracking-wide text-action">{eyebrow}</p>
    <h2 id={id} className="mt-1 text-xl font-bold">{title}</h2>
  </div>;
}
