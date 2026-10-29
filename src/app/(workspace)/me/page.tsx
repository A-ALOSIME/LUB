import { localizedMetadata } from "@/lib/localized-metadata";
import { Building2, ClipboardList, Clock } from "lucide-react";
import { MembershipHistory } from "@/features/talent/membership-history";
import type { PublicTalent } from "@/features/talent/repository";
import { redirect } from "next/navigation";
import { requireStudentUser as requireUser } from "@/features/auth/authorization";
import { getMyPageData } from "@/features/organizations/my-page-repository";
import { StorageUnavailable } from "@/components/storage-unavailable";
import { isProfileStorageConfigured } from "@/lib/env";
import { getPreferences } from "@/lib/preferences";
import { formatPersonalNumber } from "@/features/organizations/personal-display";

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

  const {notice}=await searchParams;
  const formatNumber=(value:number|string)=>formatPersonalNumber(value,locale);
  const grouped=new Map<string,PublicTalent["organizations"][number]>();
  for(const m of memberships){let org=grouped.get(m.slug);if(!org){org={id:m.slug,slug:m.slug,name:m.organizationName,logo:m.logo,type:m.type,archived:m.organizationStatus==="Archived",hours:m.hours,memberships:[]};grouped.set(m.slug,org);}org.memberships.push({start_date:m.startDate,end_date:m.endDate,status_code:m.statusCode,roles:m.roles.map(r=>({code:r.code,starts:r.startDate,ends:r.endDate,hours:r.hours}))});}
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
            {memberships.length ? <div className="mt-5"><MembershipHistory organizations={[...grouped.values()]} locale={locale}/></div> : <p className="workspace-empty">{en ? "No memberships yet." : "لا توجد عضويات."}</p>}
          </section>
  </main>;
}

function SummaryItem({ icon, label, value }: { icon: "memberships" | "tasks" | "hours"; label: string; value: string }) {
  return <div className="workspace-summary-item">
    <span aria-hidden="true" className="workspace-summary-icon">{icon==="memberships"?<Building2/>:icon==="tasks"?<ClipboardList/>:<Clock/>}</span>
    <span className="workspace-summary-main"><span className="workspace-summary-caption">{label}</span><strong className="text-xl font-semibold tabular-nums">{value}</strong></span>
  </div>;
}

function SectionHeading({ id, title }: { id: string; title: string }) {
  return <div className="workspace-section-title">
    <h2 id={id}>{title}</h2>
  </div>;
}
