"use client";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
export default function TalentError({ reset }: { reset: () => void }) {
  const en =
    typeof document !== "undefined" && document.documentElement.lang === "en";
  return (
    <main id="main" className="mx-auto max-w-6xl px-4 py-8">
      <Alert variant="destructive">
        <AlertTitle>
          {en ? "Unable to load talent" : "تعذّر تحميل المواهب"}
        </AlertTitle>
        <AlertDescription>
          {en ? "Please try again shortly." : "حاول مرة أخرى بعد قليل."}
          <Button variant="outline" onClick={reset}>
            {en ? "Try again" : "إعادة المحاولة"}
          </Button>
        </AlertDescription>
      </Alert>
    </main>
  );
}
