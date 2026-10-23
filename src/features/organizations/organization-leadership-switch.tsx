"use client";

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
  const label = en ? "Show organization leadership on the public page" : "إظهار قيادة الجهة في الصفحة العامة";
  const stateLabel = visible
    ? en ? "Leadership is public — hide" : "القيادة ظاهرة للعامة — إخفاء"
    : en ? "Leadership is hidden — show" : "القيادة مخفية عن العامة — إظهار";
  return <Card className="organization-settings-card organization-public-visibility">
    <CardHeader className="flex flex-row items-center gap-3">
      <CardTitle>{en ? "Public visibility" : "الظهور للعامة"}</CardTitle>
      <TooltipProvider><Tooltip>
        <TooltipTrigger render={<Button type="button" variant="outline" size="icon" aria-label={label} aria-pressed={visible} aria-describedby={`${id}-description`} onClick={() => { setVisible(!visible); onChange(); }} />}>
          {visible ? <Eye aria-hidden="true" /> : <EyeOff aria-hidden="true" />}
        </TooltipTrigger>
        <TooltipContent dir={en ? "ltr" : "rtl"}>{stateLabel}</TooltipContent>
      </Tooltip></TooltipProvider>
    </CardHeader>
    <CardContent>
    <input type="hidden" name="showLeadershipPublicly" value={visible ? "on" : ""} readOnly />
    <p id={`${id}-description`} className="text-sm text-muted-foreground">{en ? "When enabled, visitors can see organization and committee leaders on the public page." : "عند التفعيل، تظهر أسماء قيادة الجهة وقادة اللجان في الصفحة العامة."}</p>
    </CardContent>
  </Card>;
}
