"use client";

import {t as translateUi} from "@/lib/i18n";
import { useState } from "react";
import Image from "next/image";
import { CalendarDays, X } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogClose,
} from "@/components/ui/dialog";
import type { Locale } from "@/lib/preferences";

function PosterImage({
  src,
  natural = false,
  expanded = false,
}: {
  src: string;
  natural?: boolean;
  expanded?: boolean;
}) {
  const [portrait,setPortrait]=useState(false);
  const [loaded, setLoaded] = useState(false),
    [failed, setFailed] = useState(false);
  return (
    <div data-orientation={portrait ? "portrait" : "landscape"} data-expanded={expanded || undefined} className={natural ? "event-poster-natural" : "event-poster-frame"}>
      {!failed && !natural && (
        <span
          aria-hidden="true"
          className="event-poster-backdrop"
          style={{ backgroundImage: `url(${JSON.stringify(src)})` }}
        />
      )}
      {!loaded && !failed && (
        <Skeleton className="absolute inset-0 rounded-none" />
      )}
      {failed ? (
        <CalendarDays className="mx-auto size-10 text-muted-foreground" />
      ) : (
        <Image
          src={src}
          alt=""
          width={960}
          height={1200}
          unoptimized
          loading="lazy"
          className={
            natural
              ? "event-poster-natural-image"
              : "event-poster-contained-image"
          }
          onLoad={(event) => {setLoaded(true);setPortrait(event.currentTarget.naturalHeight > event.currentTarget.naturalWidth);}}
          onError={() => setFailed(true)}
        />
      )}
    </div>
  );
}

export function EventPoster({
  src,
  title,
  detail = false,
  locale = "ar",
}: {
  src?: string | null;
  title: string;
  detail?: boolean;
  locale?: Locale;
}) {
  const en = locale === "en";
  if (!src)
    return (
      <div className={detail ? "event-poster-natural" : "event-poster-frame"}>
        <CalendarDays className="mx-auto size-10 text-muted-foreground" />
      </div>
    );
  if (!detail) return <PosterImage key={src} src={src} />;
  return (
    <Dialog>
      <DialogTrigger
        render={
          <Button
            variant="ghost"
            className="event-poster-open"
            aria-label={
              translateUi((en) ? "en" : "ar", `تكبير بوستر ${title}`, `Enlarge poster: ${title}`)
            }
          />
        }
      >
        <PosterImage key={src} src={src} natural />
      </DialogTrigger>
      <DialogContent
        className="max-h-[95dvh] overflow-y-auto sm:max-w-4xl"
        showCloseButton={false}
      >
        <DialogHeader className="pe-8">
          <DialogTitle>{title}</DialogTitle>
          <DialogClose
            render={
              <Button
                variant="ghost"
                size="icon-sm"
                className="absolute end-3 top-3"
                aria-label={translateUi((en) ? "en" : "ar", "إغلاق البوستر", "Close poster")}
              />
            }
          >
            <X />
          </DialogClose>
        </DialogHeader>
        <PosterImage key={src} src={src} natural expanded />
      </DialogContent>
    </Dialog>
  );
}
