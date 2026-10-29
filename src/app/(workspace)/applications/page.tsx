import {t as translateUi} from "@/lib/i18n";
import {openingRequests} from "@/features/organization-requests/repository";
import {OpeningRequestList} from "@/features/organization-requests/request-list";
import { z } from "zod";
import { checkReadiness } from "@/features/hours/view";
import { myRenewals } from "@/features/renewals/repository";
import { PersonalRenewalsView } from "@/features/renewals/view";
import { localizedMetadata } from "@/lib/localized-metadata";
import { requireStudentUser as requireUser } from "@/features/auth/authorization";
import { countOwnApplications, listApplications } from "@/features/forms/repository";
import { ApplicationList } from "@/features/forms/application-list";
import { previewApplications } from "@/features/forms/application-preview";
import { applicationStatusCode, applicationStatusTabs, countApplicationStatuses, matchesApplicationStatus } from "@/features/forms/application-status";
import { MyRequestsTabs } from "@/features/forms/my-requests-tabs";
import { resolveRequestsTab } from "@/features/forms/my-requests-navigation";
import { getPreferences } from "@/lib/preferences";

export async function generateMetadata() {
  return localizedMetadata("طلباتي", "My applications");
}

export default async function Applications({ searchParams }: { searchParams: Promise<{ page?: string | string[]; preview?: string | string[]; status?: string | string[]; tab?: string | string[] }> }) {
  const [user, { locale }] = await Promise.all([requireUser(), getPreferences()]);
  const en = locale === "en";
  const query = await searchParams;
  const tab = resolveRequestsTab(query.tab);

  const previewInput = Array.isArray(query.preview) ? query.preview[0] : query.preview;
  const statusInput = Array.isArray(query.status) ? query.status[0] : query.status;
  const pageInput = Array.isArray(query.page) ? query.page[0] : query.page;
  const preview = tab==="applications" && previewInput === "1";
  const page = tab==="applications"?Math.min(1000, Math.max(1, Math.floor(Number(pageInput) || 1))):1;
  const otherPage = z.coerce.number().int().min(0).max(10000).catch(0).parse(pageInput??0);
  const renewalPage=tab==="renewals"?otherPage:0, organizationPage=tab==="organizations"?otherPage:0;
  const status = tab==="applications"?applicationStatusTabs.find(tab => tab.value === statusInput)?.value ?? "all":"all";

  // All three bounded, owner-scoped panels are read together, once per server navigation.
  // Switching categories then reuses mounted content; writes still revalidate this page.
  const [applications, renewals, organizations] = await Promise.all([
    preview ? Promise.resolve((() => {
      const filtered = previewApplications.filter(application => matchesApplicationStatus(application.status_code, status));
      return [filtered.slice((page - 1) * 25, page * 25 + 1), countApplicationStatuses(previewApplications)] as const;
    })()) : Promise.all([
      listApplications(user.id, undefined, {page,q:"",status:applicationStatusCode(status),committee:"",major:"",level:"",from:"",to:"",lookup:""}),
      countOwnApplications(user.id),
    ]),
    myRenewals(user.id,renewalPage),
    openingRequests(user.id,true,null,organizationPage),
  ]);
  if(tab==="renewals")checkReadiness(renewals?.account);
  if(!renewals)throw new Error("Renewal storage unavailable");
  const [rows,counts]=applications;
  const href=new URLSearchParams({tab});
  if(tab==="applications"){
    if(preview)href.set("preview","1");
    if(status!=="all")href.set("status",status);
    if(page>1)href.set("page",String(page));
  }else if(otherPage>0)href.set("page",String(otherPage));

  return <main id="main" dir={en ? "ltr" : "rtl"} className="workspace-page--wide min-w-0 space-y-5 pb-20 lg:pb-0">
    <header className="workspace-page-header">
      <h1>{translateUi((en) ? "en" : "ar", "طلباتي", "My requests")}</h1>
    </header>
    <MyRequestsTabs activeTab={tab} preview={preview} locale={locale} activeHref={`/applications?${href.toString()}`} panels={{
      applications:<ApplicationList rows={rows.slice(0,25)} counts={counts} locale={locale} preview={preview} status={status} page={page} hasNext={rows.length>25}/>,
      renewals:<PersonalRenewalsView data={renewals} page={renewalPage} locale={locale}/>,
      organizations:<OpeningRequestList data={organizations} locale={locale} page={organizationPage}/>,
    }}/>

  </main>;
}
