import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { Locale } from "@/lib/preferences";

export type OrganizationIdentity = { name: string; slug: string; logo?: string | null };
export function OrganizationAvatar({ name, logo }: Pick<OrganizationIdentity, "name" | "logo">) {
 return <Tooltip><TooltipTrigger render={<Avatar tabIndex={0} aria-label={name} />}><AvatarImage src={logo ?? undefined} alt=""/><AvatarFallback>{name.trim().slice(0,1)}</AvatarFallback></TooltipTrigger><TooltipContent>{name}</TooltipContent></Tooltip>;
}
export function OrganizationAvatars({items,locale="ar"}:{items:OrganizationIdentity[];locale?:Locale}) {
 return <div className="flex flex-wrap items-center gap-2">{items.slice(0,3).map(o=><OrganizationAvatar key={o.slug} name={o.name} logo={o.logo}/>)}{items.length>3&&<Avatar aria-label={locale==="en"?`${items.length-3} more organizations`:`${items.length-3} جهات أخرى`}><AvatarFallback><bdi>+{items.length-3}</bdi></AvatarFallback></Avatar>}</div>;
}
