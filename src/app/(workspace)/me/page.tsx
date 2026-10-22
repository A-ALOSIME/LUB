import { localizedMetadata } from "@/lib/localized-metadata";
import Link from "next/link";
import { redirect } from "next/navigation";
import { requireStudentUser as requireUser } from "@/features/auth/authorization";
import { getMyPageData } from "@/features/organizations/my-page-repository";
import { StorageUnavailable } from "@/components/storage-unavailable";
import { isProfileStorageConfigured } from "@/lib/env";
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

          <header id="overview" className="workspace-page-header scroll-mt-6">
            <h1>{en ? "Hello, " : "أهلًا، "}<bdi>{profile.fullName}</bdi></h1>
          </header>

          <section aria-label={en ? "Account summary" : "ملخص الحساب"} className="workspace-summary-grid">
            <SummaryItem icon="memberships" label={en ? "Active memberships" : "عضويات نشطة"} value={formatNumber(activeMemberships)} />
            <SummaryItem icon="tasks" label={en ? "Current tasks" : "مشاركات حالية"} value={formatNumber(tasks.length)} />
            <SummaryItem icon="hours" label={en ? "Approved hours" : "ساعات معتمدة"} value={formatNumber(hours)} />
          </section>

          <section id="memberships" aria-labelledby="memberships-title" className="workspace-panel workspace-my-page-section workspace-my-page-section--memberships scroll-mt-6">
            <SectionHeading id="memberships-title" title={en ? "Memberships and role history" : "عضوياتي وسجل أدواري"} />
            {memberships.length ? <ol className="mt-5 space-y-5 border-s-2 border-line ps-5">
              {memberships.map(membership => <li key={membership.id} className="relative min-w-0 before:absolute before:start-[-1.45rem] before:top-1.5 before:size-3 before:rounded-full before:border-2 before:border-action before:bg-surface">
                <article className="min-w-0 rounded-xl border border-line bg-surface p-4 sm:p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <Link href={"/organizations/" + membership.slug} dir="auto" className="break-words text-base font-semibold text-action hover:underline">{membership.organizationName}</Link>
                      <p className="mt-1 text-sm leading-6 text-muted">{en ? "Membership" : "العضوية"} · {formatDate(membership.startDate)}{membership.endDate && <> – {formatDate(membership.endDate)}</>}</p>
                    </div>
                    <span className="shrink-0 rounded-full border border-line px-2.5 py-1 text-xs font-medium text-muted">{en ? membership.statusCode === "Active" ? "Active" : membership.statusCode === "Inactive" ? "Inactive" : "Ended" : membership.statusCode === "Active" ? "نشطة" : membership.statusCode === "Inactive" ? "غير نشطة" : "منتهية"}</span>
                  </div>
                  {membership.organizationStatus === "Archived" && <p className="mt-2 text-xs text-muted">{en ? "Organization archived" : "الجهة مؤرشفة"}</p>}
                  {membership.roles.length > 0 && <ol className="mt-4 space-y-2 border-s border-line ps-4">
                    {membership.roles.map((role, index) => <li key={role.code + role.startDate + index} className="relative text-sm leading-6 before:absolute before:start-[-1.32rem] before:top-2 before:size-2 before:rounded-full before:bg-action">
                      <span className="font-medium">{roleLabels[role.code]}</span><span className="text-muted"> · {en ? "from" : "من"} {formatDate(role.startDate)}{role.endDate ? <> {en ? "to" : "إلى"} {formatDate(role.endDate)}</> : en ? ", ongoing" : "، مستمر"}</span>
                    </li>)}
                  </ol>}
                </article>
              </li>)}
            </ol> : <p className="workspace-empty">{en ? "No memberships yet." : "لا توجد عضويات."}</p>}
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

function SectionHeading({ id, title }: { id: string; title: string }) {
  return <div className="workspace-section-title">
    <h2 id={id}>{title}</h2>
  </div>;
}
