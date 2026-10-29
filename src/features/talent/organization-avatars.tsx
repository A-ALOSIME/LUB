import {t as translateUi} from "@/lib/i18n";
import {formatCount} from "@/lib/display";
import {NumberText} from "@/components/number-text";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { Locale } from "@/lib/preferences";

export type OrganizationIdentity = { name: string; slug: string; logo?: string | null };
export function OrganizationAvatar({ name, logo }: Pick<OrganizationIdentity, "name" | "logo">) {
 return <Tooltip><TooltipTrigger render={<Avatar tabIndex={0} aria-label={name} />}><AvatarImage src={logo ?? undefined} alt=""/><AvatarFallback>{name.trim().slice(0,1)}</AvatarFallback></TooltipTrigger><TooltipContent>{name}</TooltipContent></Tooltip>;
}
export function OrganizationAvatars({items,locale="ar"}:{items:OrganizationIdentity[];locale?:Locale}) {
 return <div className="flex flex-wrap items-center gap-2">{items.slice(0,3).map(o=><OrganizationAvatar key={o.slug} name={o.name} logo={o.logo}/>)}{items.length>3&&<Avatar aria-label={translateUi((locale==="en") ? "en" : "ar", `${formatCount(items.length-3,"organizations",locale)} ${items.length-3===2?"أخريان":"أخرى"}`, `${items.length-3} more ${items.length===4?"organization":"organizations"}`)}><AvatarFallback><bdi>+<NumberText value={items.length-3}/></bdi></AvatarFallback></Avatar>}</div>;
}
