import {OrganizationLogo} from "@/components/organization-logo";
import {translateContent} from "@/lib/content-translation";
import {t as translateUi} from "@/lib/i18n";
import {formatCount} from "@/lib/display";
import {NumberText} from "@/components/number-text";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { Locale } from "@/lib/preferences";

export type OrganizationIdentity = { name: string; slug: string; logo?: string | null };
export function OrganizationAvatar({ name, logo, size="default",locale="ar" }: Pick<OrganizationIdentity, "name" | "logo">&{size?:"default"|"lg";locale?:Locale}) {
 return <Tooltip><TooltipTrigger render={<OrganizationLogo name={translateContent(name,locale)} src={logo} size={size} tabIndex={0}/>}/><TooltipContent>{translateContent(name,locale)}</TooltipContent></Tooltip>;
}
export function OrganizationAvatars({items,locale="ar",size="default"}:{items:OrganizationIdentity[];locale?:Locale;size?:"default"|"lg"}) {
 return <div className="flex flex-wrap items-center gap-2">{items.slice(0,3).map(o=><OrganizationAvatar key={o.slug} name={o.name} logo={o.logo} size={size} locale={locale}/>)}{items.length>3&&<Avatar size={size} className="organization-logo rounded-lg after:rounded-lg" aria-label={translateUi((locale==="en") ? "en" : "ar", `${formatCount(items.length-3,"organizations",locale)} ${items.length-3===2?"أخريان":"أخرى"}`, `${items.length-3} more ${items.length===4?"organization":"organizations"}`)}><AvatarFallback className="rounded-lg"><bdi>+<NumberText value={items.length-3}/></bdi></AvatarFallback></Avatar>}</div>;
}
