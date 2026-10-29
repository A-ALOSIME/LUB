"use client";
import {t as translateUi} from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { TalentChannelIcon, talentChannelLabel } from "./contact-channel";
import type { PublicTalent } from "./repository";
export function TalentContactLinks({links, en}: {links: PublicTalent["links"]; en: boolean}) {
  return <TooltipProvider><nav className="mt-4 flex flex-wrap gap-2" aria-label={translateUi((en) ? "en" : "ar", "قنوات التواصل المنشورة", "Published contact channels")}>
    {links.map((link, index) => {
      const href = link.kind === "Email" ? `mailto:${link.value}` : link.kind === "Phone" ? `tel:${link.value}` : link.value;
      const label = talentChannelLabel(link.kind, en);
      return <Tooltip key={`${link.kind}-${index}`}><TooltipTrigger render={<Button nativeButton={false} role="link" variant="ghost" size="icon" render={<a href={href} target="_blank" rel="noopener noreferrer" aria-label={label}/>}/> }><TalentChannelIcon kind={link.kind}/></TooltipTrigger><TooltipContent>{label}</TooltipContent></Tooltip>;
    })}
  </nav></TooltipProvider>;
}
