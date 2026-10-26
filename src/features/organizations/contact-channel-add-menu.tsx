"use client";

import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import type { Locale } from "@/lib/preferences";
import { organizationContactAddableKinds, organizationContactLabel, type OrganizationContactKind } from "./contact-channels";
import { OrganizationSocialIcon } from "./social-links";

export function ContactChannelAddMenu({ locale, onSelect, disabled = false, kinds = organizationContactAddableKinds }: {
  locale: Locale;
  onSelect: (kind: OrganizationContactKind) => void;
  disabled?: boolean;
  kinds?: readonly OrganizationContactKind[];
}) {
  const en = locale === "en";
  return <DropdownMenu>
    <DropdownMenuTrigger render={<Button type="button" variant="outline" size="sm" disabled={disabled} className="organization-contact-add" />}>
      <Plus aria-hidden="true" />{en ? "Add channel" : "إضافة قناة"}
    </DropdownMenuTrigger>
    <DropdownMenuContent align={en ? "end" : "start"} className="min-w-40">
      <DropdownMenuGroup>{kinds.map(kind => <DropdownMenuItem key={kind} onClick={() => onSelect(kind)}>
        <OrganizationSocialIcon kind={kind} className="size-4" />
        {organizationContactLabel(kind, en)}
      </DropdownMenuItem>)}</DropdownMenuGroup>
    </DropdownMenuContent>
  </DropdownMenu>;
}
