"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LubBrandName } from "@/components/lub-brand-name";

const sidebarRoutes=["/manage","/me","/account","/activity","/applications","/tasks","/renewals","/hours","/notifications","/events/mine"];
export function showAssistantLauncher(path: string) {
  return path!=="/ai" && !sidebarRoutes.some(route=>path===route||path.startsWith(`${route}/`));
}
export function DeferredChatWidget({locale}: {locale: "ar"|"en"}) {
  const path=usePathname()??"",en=locale==="en";
  if(!showAssistantLauncher(path))return null;
  return <Button nativeButton={false} role="link" render={<Link href="/ai" prefetch={false}/>} className="floating-assistant-link" aria-label={en?"Ask LUB":"اسأل لُبّ"}><MessageCircle/><span className="hidden sm:inline">{en?"Ask LUB":<>اسأل <LubBrandName/></>}</span></Button>;
}
