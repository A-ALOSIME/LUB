import Link from "next/link";
import Image from "next/image";
import { cn } from "cn";

export function Brand({ en = false, href = "/", className }: { en?: boolean; href?: string; className?: string }) {
  return <Link href={href} prefetch={false} aria-label={href === "/manage" ? (en ? "System dashboard" : "لوحة النظام") : (en ? "LUB home" : "لُبّ، الرئيسية")} className={cn("brand-mark shrink-0", className)}>
    <Image src={en ? "/brand/logo-en-light.8eafe2d31f96.svg" : "/brand/logo.d904bc5ef68d.svg"} alt="" width={en ? 496 : 315} height={en ? 200 : 150} priority className={"brand-light h-auto " + (en ? "w-[130px] sm:w-[145px]" : "w-[106px] sm:w-[116px]")} />
    <Image src={en ? "/brand/logo-en-reversed-transparent.4413739bac0b.svg" : "/brand/logo-reversed.4c09d1c07d25.svg"} alt="" width={en ? 496 : 315} height={en ? 200 : 150} className={"brand-dark h-auto " + (en ? "w-[130px] sm:w-[145px]" : "w-[106px] sm:w-[116px]")} />
  </Link>;
}
