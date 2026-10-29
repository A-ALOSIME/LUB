"use client";

import {t as translateUi} from "@/lib/i18n";
import { useId, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import type { Locale } from "@/lib/preferences";
import { useProfileFormState } from "./profile-form-state";

export function OrganizationLeadershipVisibilityButton({ defaultChecked, locale }: { defaultChecked: boolean; locale: Locale }) {
  const { resetKey, resetValues, markChanged } = useProfileFormState();
  const visible = Object.hasOwn(resetValues, "showLeadershipPublicly")
    ? resetValues.showLeadershipPublicly === "on"
    : defaultChecked;
  return <LeadershipVisibilityButtonState key={resetKey} defaultChecked={visible} locale={locale} onChange={markChanged} />;
}

function LeadershipVisibilityButtonState({ defaultChecked, locale, onChange }: { defaultChecked: boolean; locale: Locale; onChange: () => void }) {
  const [visible, setVisible] = useState(defaultChecked);
  const id = useId();
  const en = locale === "en";
  const label = translateUi((en) ? "en" : "ar", "إظهار قيادة الجهة في الصفحة العامة", "Show organization leadership on the public page");
  const stateLabel = visible
    ? translateUi((en) ? "en" : "ar", "القيادة ظاهرة للعامة — إخفاء", "Leadership is public — hide")
    : translateUi((en) ? "en" : "ar", "القيادة مخفية عن العامة — إظهار", "Leadership is hidden — show");
  return <Card className="organization-settings-card organization-public-visibility">
    <CardHeader className="flex flex-row items-center gap-3">
      <CardTitle>{translateUi((en) ? "en" : "ar", "الظهور للعامة", "Public visibility")}</CardTitle>
      <TooltipProvider><Tooltip>
        <TooltipTrigger render={<Button type="button" variant="outline" size="icon" aria-label={label} aria-pressed={visible} aria-describedby={`${id}-description`} onClick={() => { setVisible(!visible); onChange(); }} />}>
          {visible ? <Eye aria-hidden="true" /> : <EyeOff aria-hidden="true" />}
        </TooltipTrigger>
        <TooltipContent dir={en ? "ltr" : "rtl"}>{stateLabel}</TooltipContent>
      </Tooltip></TooltipProvider>
    </CardHeader>
    <CardContent>
    <input type="hidden" name="showLeadershipPublicly" value={visible ? "on" : ""} readOnly />
    <p id={`${id}-description`} className="text-sm text-muted-foreground">{translateUi((en) ? "en" : "ar", "عند التفعيل، تظهر أسماء قيادة الجهة وقادة اللجان في الصفحة العامة.", "When enabled, visitors can see organization and committee leaders on the public page.")}</p>
    </CardContent>
  </Card>;
}
