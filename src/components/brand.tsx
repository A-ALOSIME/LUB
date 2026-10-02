import Link from "next/link";
import Image from "next/image";

export function Brand({ en = false }: { en?: boolean }) {
  return <Link href="/" aria-label={en ? "LUB — Home" : "لُبّ — الرئيسية"} className="brand-mark shrink-0">
    <Image src="/brand/logo.svg" alt="" width={315} height={150} priority className="brand-light h-auto w-[106px] sm:w-[116px]" />
    <Image src="/brand/logo-reversed.svg" alt="" width={315} height={150} className="brand-dark h-auto w-[106px] sm:w-[116px]" />
  </Link>;
}
