"use client";
import Link from "next/link";
import {usePathname} from "next/navigation";
export function SiteNavigation({en}:{en:boolean}) {
 const path=usePathname()??"";
 const items=[{href:"/organizations",match:"/organizations",label:en?"Clubs and councils":"الأندية والمجالس"},{href:"/events/discover",match:"/events",label:en?"Events":"الفعاليات"},{href:"/talent",match:"/talent",label:en?"Talent":"المواهب"},{href:"/ai",match:"/ai",label:en?"Ask LUB":"اسأل لُبّ"}];
 return <nav dir={en?"ltr":"rtl"} aria-label={en?"Main navigation":"التنقل الرئيسي"} className="site-nav site-header-nav">{items.map(item=><Link key={item.href} href={item.href} prefetch={item.href!=="/ai"} aria-current={path===item.match||path.startsWith(item.match+"/")?"page":undefined}>{item.label}</Link>)}</nav>;
}
