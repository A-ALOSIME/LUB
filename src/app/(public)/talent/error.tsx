"use client";
import {t as translateUi} from "@/lib/i18n";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
export default function TalentError({ reset }: { reset: () => void }) {
  const en =
    typeof document !== "undefined" && document.documentElement.lang === "en";
  return (
    <main id="main" className="mx-auto max-w-6xl px-4 py-8">
      <Alert variant="destructive">
        <AlertTitle>
          {translateUi((en) ? "en" : "ar", "تعذّر تحميل المواهب", "Unable to load talent")}
        </AlertTitle>
        <AlertDescription>
          {translateUi((en) ? "en" : "ar", "حاول مرة أخرى بعد قليل.", "Please try again shortly.")}
          <Button variant="outline" onClick={reset}>
            {translateUi((en) ? "en" : "ar", "إعادة المحاولة", "Try again")}
          </Button>
        </AlertDescription>
      </Alert>
    </main>
  );
}
