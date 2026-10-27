"use client";
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
      locale={locale}
      fields={{ summary: "", mission: "" }}
      submitLabel={en ? "Create organization" : "إنشاء الجهة"}
    >
      <FieldGroup>
        <FormField label={en ? "Organization name" : "اسم الجهة"}>
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
