import { organizationContactAddableKinds, organizationContactLabel, type OrganizationContactKind } from "@/features/organizations/contact-channels";
import { OrganizationSocialIcon } from "@/features/organizations/social-links";

export type TalentChannelKind = OrganizationContactKind;
export const talentAddableChannelKinds = [...organizationContactAddableKinds,"Behance"] as const;

export function TalentChannelIcon({ kind, className = "size-4" }: { kind: string; className?: string }) {
  return <OrganizationSocialIcon kind={kind} className={className} />;
}

export function talentChannelLabel(kind: string, en: boolean) {
  const label=organizationContactLabel(kind,en);return en?label:kind==="Website"?"الموقع الشخصي":kind==="Email"?"البريد الإلكتروني":`حساب ${label}`;
}
