"use client";
import {t as translateUi} from "@/lib/i18n";
import Link from "next/link";
import {Button} from "@/components/ui/button";
import { useState } from "react";
import { FormField } from "@/components/form-field";
import { FieldGroup } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { MutationForm } from "./mutation-form";
import { OrganizationSlugField } from "./organization-slug-field";
import { LeaderEmailSearch } from "./leader-email-search";
import { suggestOrganizationSlug } from "./organization-slug";
import type { Locale } from "@/lib/preferences";
export function CreateOrganizationForm({ locale }: { locale: Locale }) {
  const en = locale === "en",
    [slug, setSlug] = useState(""),
    [edited, setEdited] = useState(false);
  return (
    <MutationForm
      operation="create-org"
      inlineFooter
      formClassName="flex flex-col gap-6"
      footerAction={<Button variant="ghost" nativeButton={false} render={<Link href="/manage/organizations"/>}>{translateUi((en) ? "en" : "ar", "إلغاء", "Cancel")}</Button>}
      locale={locale}
      fields={{ summary: "", mission: "" }}
      submitLabel={translateUi((en) ? "en" : "ar", "إنشاء الجهة", "Create organization")}
    >
      <FieldGroup className="grid gap-5 sm:grid-cols-2">
        <FormField label={translateUi((en) ? "en" : "ar", "اسم الجهة", "Organization name")} required>
          <Input
            name="nameAr"
            required
            minLength={2}
            maxLength={120}
            autoFocus
            onChange={(e) => {
              if (!edited) setSlug(suggestOrganizationSlug(e.target.value));
            }}
          />
        </FormField>
        <FormField label={translateUi((en) ? "en" : "ar", "النوع", "Type")} required>
          <Select
            name="typeCode"
            defaultValue="Club"
            items={{
              Club: translateUi((en) ? "en" : "ar", "نادي", "Club"),
              Council: translateUi((en) ? "en" : "ar", "مجلس", "Council"),
            }}
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Club">{translateUi((en) ? "en" : "ar", "نادي", "Club")}</SelectItem>
              <SelectItem value="Council">{translateUi((en) ? "en" : "ar", "مجلس", "Council")}</SelectItem>
            </SelectContent>
          </Select>
        </FormField>
        <OrganizationSlugField
          value={slug}
          onChange={(value) => {
            setEdited(true);
            setSlug(value);
          }}
          locale={locale}
        />
        <LeaderEmailSearch locale={locale} />
      </FieldGroup>
    </MutationForm>
  );
}
