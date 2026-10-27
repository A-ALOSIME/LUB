"use client";
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
      footerAction={<Button variant="ghost" nativeButton={false} render={<Link href="/manage/organizations"/>}>{en?"Cancel":"إلغاء"}</Button>}
      locale={locale}
      fields={{ summary: "", mission: "" }}
      submitLabel={en ? "Create organization" : "إنشاء الجهة"}
    >
      <FieldGroup className="grid gap-5 sm:grid-cols-2">
        <FormField label={en ? "Organization name" : "اسم الجهة"} required>
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
        <FormField label={en ? "Type" : "النوع"} required>
          <Select
            name="typeCode"
            defaultValue="Club"
            items={{
              Club: en ? "Club" : "نادي",
              Council: en ? "Council" : "مجلس",
            }}
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Club">{en ? "Club" : "نادي"}</SelectItem>
              <SelectItem value="Council">{en ? "Council" : "مجلس"}</SelectItem>
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
