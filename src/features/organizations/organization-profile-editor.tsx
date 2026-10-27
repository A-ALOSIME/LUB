import Link from "next/link";
import {
  FileText,
  Globe,
  Info,
  MessageSquare,
  Settings2,
  UsersRound,
} from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { CommitteeDialog } from "@/features/organizations/committee-dialog";
import { OrganizationCommitteeChart } from "@/features/organizations/organization-committee-chart";
import { localOrganizationContent } from "@/features/organizations/local-content";
import { OrganizationContactChannelEditor } from "@/features/organizations/contact-channel-editor";
import { OrganizationCharacterCountTextarea } from "@/features/organizations/character-count-textarea";
import {
  profileLinksToContactChannels,
  storedLinksToContactChannels,
} from "@/features/organizations/contact-channels";
import { OrganizationInterestEditor } from "@/features/organizations/organization-interest-editor";
import { OrganizationLogoEditor } from "@/features/organizations/logo-editor";
import { OrganizationLeadershipVisibilityButton } from "@/features/organizations/organization-leadership-switch";
import { OrganizationPublicProfileEditor } from "@/features/organizations/public-profile-editor";
import { buildCommitteeTree } from "@/features/organizations/committee-tree";
import {
  OrganizationSectionTabPanel,
  OrganizationSectionTabs,
} from "@/features/organizations/organization-section-tabs";
import { MutationForm } from "@/features/organizations/mutation-form";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/form-field";

import type { ReactNode } from "react";
import type { Locale } from "@/lib/preferences";
import type { getManagementOrganization } from "./management-repository";

export function OrganizationProfileEditor({
  managed,
  locale,
  section,
  adminControls,
}: {
  managed: NonNullable<Awaited<ReturnType<typeof getManagementOrganization>>>;
  locale: Locale;
  section?: string;
  adminControls?: ReactNode;
}) {
  const id = managed.organization.id;
  const { organization, committees, contacts } = managed;
  const en = locale === "en";
  const c = (ar: string, english: string) => (en ? english : ar);
  const curatedProfile = localOrganizationContent(
    organization.nameAr,
    organization.typeCode,
  );
  const savedChannels = storedLinksToContactChannels(contacts);
  const initialChannels =
    organization.linksCustomized || savedChannels.length
      ? savedChannels
      : profileLinksToContactChannels(curatedProfile?.links);
  const showCommittees =
    committees.length > 0 || organization.canManageCommittees;
  const committeeTree = buildCommitteeTree(
    committees.filter((committee) => committee.statusCode === "Active"),
  );
  const parentOptions = committees
    .filter(
      (committee) => committee.statusCode === "Active" && committee.canEdit,
    )
    .map(({ id, name }) => ({ id, name }));
  const tabs = [
    {
      id: "about",
      label: c("الأساسية", "Basics"),
      icon: <Info aria-hidden="true" />,
    },
    ...(organization.canEdit
      ? [
          {
            id: "profile",
            label: c("المحتوى والإنجازات", "Content and achievements"),
            icon: <FileText aria-hidden="true" />,
          },
          {
            id: "contacts",
            label: c("التواصل والنشر", "Contact and visibility"),
            icon: <MessageSquare aria-hidden="true" />,
          },
        ]
      : []),
    ...(showCommittees
      ? [
          {
            id: "committees",
            label: c("اللجان", "Committees"),
            icon: <UsersRound aria-hidden="true" />,
          },
        ]
      : []),
    ...(adminControls
      ? [
          {
            id: "administration",
            label: c("إدارة الجهة", "Administration"),
            icon: <Settings2 aria-hidden="true" />,
          },
        ]
      : []),
  ];
  const initialSection = tabs.some((tab) => tab.id === section)
    ? section!
    : "about";
  const publicPageButton = (
    <div className="organization-public-page-footer">
      <Button
        nativeButton={false}
        render={
          <Link
            href={`/organizations/${organization.slug}`}
            aria-label={c("عرض الصفحة العامة", "View public page")}
            title={c("عرض الصفحة العامة", "View public page")}
          />
        }
        variant="outline"
        size="lg"
        className="organization-public-page-button"
      >
        <Globe aria-hidden="true" data-icon="inline-start" />
        {c("عرض", "View")}
      </Button>
    </div>
  );

  return (
    <div className="organization-settings space-y-5">
      <header className="workspace-page-header organization-about-heading">
        <div className="min-w-0">
          <h1>{c("بيانات الجهة", "Organization details")}</h1>
        </div>
      </header>

      <OrganizationSectionTabs
        items={tabs}
        initialSection={initialSection}
        defaultSection="about"
        legacyHashSections={{ "#committees": "committees" }}
        sticky={false}
        label={c("أقسام الجهة", "Organization sections")}
        dir={en ? "ltr" : "rtl"}
      >
        {organization.canEdit ? (
          <MutationForm
            operation="org-profile"
            fields={{ organizationId: id }}
            submitLabel={c("حفظ", "Save")}
            locale={locale}
            formClassName="organization-settings-form"
            buttonClassName="button button-compact w-fit"
            stickySaveBar
          >
            <OrganizationSectionTabPanel id="about">
              <div className="organization-settings-sections">
                <Card
                  className="organization-settings-card"
                  aria-label={c(
                    "بيانات الجهة الأساسية",
                    "Basic organization details",
                  )}
                >
                  <CardHeader className="organization-settings-card-header">
                    <h2 className="organization-settings-section-title">
                      {c("بيانات الجهة الأساسية", "Basic details")}
                    </h2>
                  </CardHeader>
                  <CardContent className="organization-settings-card-content">
                    <div className="organization-settings-fields">
                      <div className="organization-settings-identity-field full">
                        <OrganizationLogoEditor
                          organizationId={id}
                          organizationName={organization.nameAr}
                          logoUrl={organization.logoUrl}
                          fallbackLogoUrl={curatedProfile?.logoSrc}
                          locale={locale}
                        />
                        <FormField
                          className="organization-settings-field min-w-0"
                          id="edit-name"
                          label={<>{c("اسم الجهة", "Organization name")}</>}
                        >
                          <Input
                            id="edit-name"
                            name="nameAr"
                            dir={en ? "ltr" : "rtl"}
                            placeholder={c(
                              "مثال: نادي علوم الحاسب",
                              "e.g. Computer Science Club",
                            )}
                            required
                            minLength={2}
                            maxLength={120}
                            defaultValue={organization.nameAr}
                          />
                        </FormField>
                      </div>
                      <div className="organization-about-text-fields full">
                        <FormField
                          className="organization-settings-field"
                          id="edit-summary"
                          label={c("النبذة", "Short description")}
                        >
                          <OrganizationCharacterCountTextarea
                            id="edit-summary"
                            name="summary"
                            defaultValue={organization.summary}
                            maxLength={1000}
                            locale={locale}
                            rows={2}
                            placeholder={c(
                              "مثال: مجتمع طلابي يجمع المهتمين بالتقنية",
                              "Example: A student community for technology enthusiasts",
                            )}
                          />
                        </FormField>
                        <FormField
                          className="organization-settings-field"
                          id="edit-mission"
                          label={c("رسالة الجهة", "Mission")}
                        >
                          <OrganizationCharacterCountTextarea
                            id="edit-mission"
                            name="mission"
                            defaultValue={organization.mission}
                            maxLength={3000}
                            locale={locale}
                            rows={2}
                            placeholder={c(
                              "مثال: تمكين الطلاب وتطوير مهاراتهم",
                              "Example: Empowering students and growing their skills",
                            )}
                          />
                        </FormField>
                      </div>
                      <FormField
                        className="organization-settings-field full organization-settings-interests"
                        label={c("مجالات الاهتمام", "Interests")}
                      >
                        <OrganizationInterestEditor
                          initialInterests={managed.tagNames}
                          locale={locale}
                        />
                      </FormField>
                    </div>
                  </CardContent>
                </Card>
              </div>
              {publicPageButton}
            </OrganizationSectionTabPanel>
            <OrganizationSectionTabPanel id="profile">
              <OrganizationPublicProfileEditor
                organizationId={id}
                locale={locale}
                initialValue={organization.publicProfileContent}
              />
              {publicPageButton}
            </OrganizationSectionTabPanel>
            <OrganizationSectionTabPanel id="contacts">
              <div className="organization-settings-sections">
                <Card
                  className="organization-settings-card organization-contact-settings-card"
                  aria-label={c("قنوات التواصل", "Contact channels")}
                >
                  <CardContent className="organization-settings-card-content">
                    <OrganizationContactChannelEditor
                      initialChannels={initialChannels}
                      locale={locale}
                    />
                  </CardContent>
                </Card>
                <OrganizationLeadershipVisibilityButton
                  defaultChecked={organization.showLeadershipPublicly}
                  locale={locale}
                />
                {publicPageButton}
              </div>
            </OrganizationSectionTabPanel>
          </MutationForm>
        ) : (
          <OrganizationSectionTabPanel id="about">
            <Card className="organization-settings-card">
              <CardContent>
                <p className="organization-settings-empty">
                  {c(
                    "لا تملك صلاحية تعديل بيانات الجهة.",
                    "You do not have permission to edit organization details.",
                  )}
                </p>
              </CardContent>
            </Card>
          </OrganizationSectionTabPanel>
        )}

        {showCommittees && (
          <OrganizationSectionTabPanel id="committees" legacyId="committees">
            <header
              className="organization-committees-heading"
              dir={en ? "ltr" : "rtl"}
            >
              <h2>{c("هيكل اللجان", "Committee structure")}</h2>
              {organization.canManageCommittees && (
                <CommitteeDialog
                  organizationId={id}
                  locale={locale}
                  parentOptions={parentOptions}
                />
              )}
            </header>
            <OrganizationCommitteeChart
              organizationId={id}
              organizationName={organization.nameAr}
              committees={committeeTree}
              canManage={organization.canManageCommittees}
              locale={locale}
              parentOptions={parentOptions}
              emptyMessage={c(
                "ما فيه لجان مسجلة حتى الآن.",
                "No committees have been added yet.",
              )}
            />
            {publicPageButton}
          </OrganizationSectionTabPanel>
        )}
        {adminControls && (
          <OrganizationSectionTabPanel id="administration">
            {adminControls}
            {publicPageButton}
          </OrganizationSectionTabPanel>
        )}
      </OrganizationSectionTabs>
    </div>
  );
}
