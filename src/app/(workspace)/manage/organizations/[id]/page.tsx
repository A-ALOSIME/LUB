import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { WorkspaceIcon } from "@/components/workspace-icon";
import { requireManagementUser } from "@/features/organizations/access";
import { CommitteeFields } from "@/features/organizations/form-fields";
import { getManagementOrganization } from "@/features/organizations/management-repository";
import { MutationForm } from "@/features/organizations/mutation-form";
import { localizedMetadata } from "@/lib/localized-metadata";
import { getPreferences } from "@/lib/preferences";
import { AnnouncementDialog } from "./announcement-dialog";

export async function generateMetadata() {
  return localizedMetadata("بيانات الجهة", "Organization details");
}

export default async function ManageOrganizationPage({ params }: { params: Promise<{ id: string }> }) {
  const [{ id }, { locale }, user] = await Promise.all([params, getPreferences(), requireManagementUser()]);
  if (!z.uuid().safeParse(id).success) notFound();
  const managed = await getManagementOrganization(user.id, id);
  if (!managed) notFound();

  const { organization, committees } = managed;
  const en = locale === "en";
  const c = (ar: string, english: string) => en ? english : ar;

  return <div className="organization-settings space-y-6">
    <header className="organization-settings-header">
      <div className="min-w-0">
        <nav aria-label={c("مسار الصفحة", "Breadcrumb")} className="mb-3 flex flex-wrap items-center gap-2 text-sm text-muted">
          <Link href="/me" className="hover:text-action">{c("مساحتي", "My workspace")}</Link>
          <span aria-hidden="true">/</span><span dir="auto">{organization.nameAr}</span>
        </nav>
        <h1 className="text-3xl font-bold leading-tight">{c("بيانات الجهة", "Organization details")}</h1>
        <p className="mt-2 text-sm leading-7 text-muted">{c("حدّث ما يظهر عن جهتك للزوار، وأدر الإعلانات واللجان من هنا.", "Update public organization details, announcements and committees here.")}</p>
      </div>
      <Link href={`/organizations/${organization.slug}`} className="button button-secondary shrink-0">{c("عرض الصفحة العامة", "View public page")}</Link>
    </header>

    {organization.canEdit && <Card className="organization-settings-card" aria-label={c("بيانات الجهة", "Organization details")}>
      <CardContent>
        <div className="organization-settings-identity">
          <div className="organization-settings-logo">
            {organization.logoUrl ? <Image src={organization.logoUrl} alt="" width={76} height={76} unoptimized className="h-full w-full object-contain" /> : <WorkspaceIcon name="organization" className="size-8 text-action" />}
          </div>
          <div className="min-w-0"><p className="text-sm font-semibold text-muted">{c("هوية الجهة", "Organization identity")}</p><p dir="auto" className="mt-1 break-words text-lg font-bold">{organization.nameAr}</p></div>
        </div>
        <MutationForm operation="org-profile" fields={{ organizationId: id }} submitLabel={c("حفظ بيانات الجهة", "Save organization details")} locale={locale}>
          <div className="organization-settings-fields">
            <div className="organization-settings-field full"><label htmlFor="edit-name">{c("اسم الجهة", "Organization name")}</label><Input id="edit-name" name="nameAr" dir="auto" required minLength={2} maxLength={120} defaultValue={organization.nameAr} /></div>
            <div className="organization-settings-field"><label htmlFor="edit-summary">{c("النبذة", "Short description")}</label><Textarea id="edit-summary" name="summary" dir="auto" rows={4} maxLength={1000} defaultValue={organization.summary} /></div>
            <div className="organization-settings-field"><label htmlFor="edit-mission">{c("رسالة الجهة", "Mission")}</label><Textarea id="edit-mission" name="mission" dir="auto" rows={4} maxLength={3000} defaultValue={organization.mission} /></div>
            <div className="organization-settings-field"><label htmlFor="edit-tags">{c("مجالات الاهتمام", "Interests")}</label><Input id="edit-tags" name="tagNames" dir="auto" maxLength={500} defaultValue={managed.tagNames} aria-describedby="tags-help" /><p id="tags-help" className="text-xs leading-5 text-muted">{c("افصل المجالات بفاصلة، حتى 10 مجالات.", "Separate up to 10 interests with commas.")}</p></div>
            <div className="organization-settings-field"><label htmlFor="edit-website">{c("رابط الموقع أو التواصل", "Website or contact URL")}</label><Input id="edit-website" name="websiteUrl" type="url" dir="ltr" maxLength={2048} defaultValue={managed.websiteUrl} placeholder="https://" /></div>
            <div className="organization-settings-field full"><label htmlFor="edit-logo">{c("رابط الشعار", "Logo URL")}</label><Input id="edit-logo" name="logoUrl" type="url" dir="ltr" maxLength={2048} defaultValue={organization.logoUrl} placeholder="https://" /><p className="text-xs leading-5 text-muted">{c("رابط HTTPS مباشر للصورة؛ يظهر الشعار الحالي في الأعلى.", "A direct HTTPS image URL; the current logo appears above.")}</p></div>
          </div>
          <label className="organization-settings-visibility"><input type="checkbox" name="showLeadershipPublicly" defaultChecked={organization.showLeadershipPublicly} /><span><strong>{c("إظهار قيادة الجهة للعامة", "Show leadership publicly")}</strong><small>{c("يظهر القادة على الصفحة العامة عند تفعيله.", "Leaders appear on the public page when enabled.")}</small></span></label>
        </MutationForm>
      </CardContent>
    </Card>}

    {organization.canEdit && <Card className="organization-settings-card" aria-labelledby="announcements-title">
      <CardHeader className="organization-settings-section-header">
        <div><CardTitle id="announcements-title" className="text-xl font-bold">{c("إعلانات الجهة", "Announcements")}</CardTitle><p className="mt-1 text-sm text-muted">{c("الإعلانات المنشورة تظهر للزوار. يمكن تثبيت إعلان واحد.", "Published announcements are visible to visitors. One can be pinned.")}</p></div>
        <AnnouncementDialog organizationId={id} locale={locale} />
      </CardHeader>
      <CardContent>
        {organization.announcements.length ? <ul className="organization-settings-list">
          {organization.announcements.map(announcement => <li key={announcement.id} className="organization-settings-list-row">
            <div className="min-w-0"><p dir="auto" className="truncate font-semibold">{announcement.title}</p><div className="mt-2 flex flex-wrap gap-2"><Badge variant={announcement.published ? "secondary" : "outline"}>{announcement.published ? c("منشور", "Published") : c("مسودة", "Draft")}</Badge>{announcement.pinned && <Badge variant="outline">{c("مثبّت", "Pinned")}</Badge>}</div></div>
            <AnnouncementDialog organizationId={id} announcement={announcement} locale={locale} />
          </li>)}
        </ul> : <div className="organization-settings-empty">{c("ما فيه إعلانات بعد. أضف أول إعلان من الزر أعلاه.", "No announcements yet. Add the first one above.")}</div>}
      </CardContent>
    </Card>}

    {(committees.length > 0 || organization.canManageCommittees) && <Card id="committees" className="organization-settings-card" aria-labelledby="committees-title">
      <CardHeader><CardTitle id="committees-title" className="text-xl font-bold">{c("اللجان", "Committees")}</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        {committees.map(committee => <details key={committee.id} className="organization-settings-committee">
          <summary><span dir="auto" className="min-w-0 break-words font-semibold">{committee.name}</span><Badge variant="outline">{committee.statusCode === "Archived" ? c("مؤرشفة", "Archived") : committee.isPublic ? c("ظاهرة للعامة", "Public") : c("داخلية", "Internal")}</Badge></summary>
          <div className="space-y-5 border-t border-line p-5">
            {committee.statusCode === "Active" && committee.canEdit && <MutationForm operation="save-committee" fields={{ organizationId: id, committeeId: committee.id }} submitLabel={c("حفظ اللجنة", "Save committee")} locale={locale}><CommitteeFields prefix={committee.id} value={committee} locale={locale}/></MutationForm>}
            {organization.canManageCommittees && <div className="flex flex-wrap gap-4 border-t border-line pt-4"><MutationForm operation="copy-committee" fields={{ organizationId: id, committeeId: committee.id }} submitLabel={c("نسخ اللجنة", "Copy committee")} locale={locale}/><MutationForm operation="committee-status" fields={{ organizationId: id, committeeId: committee.id, status: committee.statusCode === "Archived" ? "Active" : "Archived" }} submitLabel={committee.statusCode === "Archived" ? c("استعادة اللجنة", "Restore committee") : c("أرشفة اللجنة", "Archive committee")} confirmLabel={committee.statusCode === "Archived" ? c("أؤكد استعادة اللجنة", "I confirm restoring this committee") : c("أؤكد أرشفة اللجنة مع حفظ تاريخها", "I confirm archiving this committee while preserving its history")} locale={locale}/></div>}
          </div>
        </details>)}
        {organization.canManageCommittees && <details className="organization-settings-committee"><summary className="font-semibold text-action">{c("إضافة لجنة", "Add committee")}</summary><div className="border-t border-line p-5"><MutationForm operation="save-committee" fields={{ organizationId: id }} submitLabel={c("إنشاء اللجنة", "Create committee")} locale={locale}><CommitteeFields prefix="new-committee" locale={locale}/></MutationForm></div></details>}
      </CardContent>
    </Card>}
  </div>;
}
