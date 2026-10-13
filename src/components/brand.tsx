import Link from "next/link";
import Image from "next/image";

export function Brand({ en = false, href = "/" }: { en?: boolean; href?: string }) {
  return <Link href={href} prefetch={false} aria-label={href === "/manage" ? (en ? "System dashboard" : "لوحة النظام") : (en ? "LUB home" : "لُبّ، الرئيسية")} className="brand-mark shrink-0">
    <Image src={en ? "/brand/logo-en-light.svg" : "/brand/logo.svg"} alt="" width={en ? 496 : 315} height={en ? 200 : 150} priority className={"brand-light h-auto " + (en ? "w-[130px] sm:w-[145px]" : "w-[106px] sm:w-[116px]")} />
    <Image src={en ? "/brand/logo-en-reversed-transparent.svg" : "/brand/logo-reversed.svg"} alt="" width={en ? 496 : 315} height={en ? 200 : 150} className={"brand-dark h-auto " + (en ? "w-[130px] sm:w-[145px]" : "w-[106px] sm:w-[116px]")} />
  </Link>;
}
