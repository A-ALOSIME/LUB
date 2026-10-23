"use client";

import { useId, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
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
  return <Card className="organization-settings-card organization-public-visibility">
    <CardHeader><CardTitle>{en ? "Public visibility" : "الظهور للعامة"}</CardTitle></CardHeader>
    <CardContent>
    <div className="flex items-center gap-3">
    <label htmlFor={id}>{en ? "Show organization leadership on the public page" : "إظهار قيادة الجهة في الصفحة العامة"}</label>
    <input type="hidden" name="showLeadershipPublicly" value={visible ? "on" : ""} readOnly />
    <Switch id={id} checked={visible} onCheckedChange={checked => { setVisible(checked); onChange(); }} aria-describedby={`${id}-description`} />
    </div>
    <p id={`${id}-description`} className="mt-2 text-sm text-muted-foreground">{en ? "Visitors can see the leadership team when this option is enabled." : "عند التفعيل، يتمكن الزوار من رؤية قيادة الجهة في صفحتها العامة."}</p>
    </CardContent>
  </Card>;
}
