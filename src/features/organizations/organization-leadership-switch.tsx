"use client";

import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
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
  const en = locale === "en";
  const status = visible
    ? en ? "Organization leadership: public" : "قيادة الجهة: ظاهرة للعامة"
    : en ? "Organization leadership: hidden" : "قيادة الجهة: مخفية";

  return <div className="organization-settings-visibility">
    <input type="hidden" name="showLeadershipPublicly" value={visible ? "on" : ""} readOnly />
    <Button
      type="button"
      variant={visible ? "default" : "outline"}
      size="lg"
      className={visible ? "organization-leadership-visibility-button" : "organization-leadership-visibility-button text-muted-foreground"}
      aria-label={status}
      aria-pressed={visible}
      title={en ? "Show leadership on the public page" : "إظهار قيادة الجهة في الصفحة العامة"}
      onClick={() => { setVisible(current => !current); onChange(); }}
    >
      {visible ? <Eye aria-hidden="true" /> : <EyeOff aria-hidden="true" />}
      <span>{status}</span>
    </Button>
  </div>;
}
