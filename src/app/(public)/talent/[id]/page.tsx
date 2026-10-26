import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { z } from "zod";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import {
  publicTalent,
  talentPages,
  isTalentOwner,
} from "@/features/talent/repository";
import { talentReturnPath } from "@/features/talent/filters";
import { PublicTalentView } from "@/features/talent/view";
import { getVerifiedUser } from "@/features/auth/session";
import { getPreferences } from "@/lib/preferences";
import { Button } from "@/components/ui/button";
export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success)
    return { robots: { index: false, follow: false } };
  const p = await publicTalent(id, {
    organizations: 0,
    events: 0,
    projects: 0,
    sources: 0,
  });
  if (!p) return { robots: { index: false, follow: false } };
  const title = p.name,
    description = p.bio ?? `${p.major} · لُبّ`,
    image = p.avatar_version
      ? `/talent/${p.id}/avatar?v=${encodeURIComponent(p.avatar_version)}`
      : "/brand/share-card.png";
  return {
    title,
    description,
    alternates: { canonical: `/talent/${p.id}` },
    robots: { index: p.indexable ?? false, follow: p.indexable ?? false },
    openGraph: { title, description, images: [{ url: image, alt: title }] },
    twitter: { card: "summary", title, description, images: [image] },
  };
}
export default async function TalentProfile({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const [query, { locale }, user] = await Promise.all([
    searchParams,
    getPreferences(),
    getVerifiedUser(),
  ]);
  const pages = talentPages(query),
    profile = await publicTalent(id, pages);
  if (!profile) notFound();
  const from = talentReturnPath(query.from),
    owner = user ? await isTalentOwner(user.id, id) : false,
    en = locale === "en";
  return (
    <main
      id="main"
      dir={en ? "ltr" : "rtl"}
      className="mx-auto flex w-full max-w-6xl flex-col gap-5 px-4 py-6 sm:px-8"
    >
      <Button
        nativeButton={false}
        variant="ghost"
        className="self-start"
        render={<Link href={from} />}
      >
        <ArrowLeft className="rtl:rotate-180" />
        {en ? "Back to talent discovery" : "العودة لاكتشاف المواهب"}
      </Button>
      <PublicTalentView
        profile={profile}
        pages={pages}
        locale={locale}
        owner={owner}
        from={from}
      />
    </main>
  );
}
