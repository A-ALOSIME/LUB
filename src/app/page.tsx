import Link from "next/link";
import Image from "next/image";
import { PublicHeader } from "@/components/public-header";
import { JsonLd } from "@/lib/json-ld";
import { getPreferences } from "@/lib/preferences";

export default async function Home() {
  const en = (await getPreferences()).locale === "en";
  const description = en
    ? "Discover student clubs, councils, and events at the College of Computer and Information Sciences, Imam Mohammad Ibn Saud Islamic University, through LUB."
    : "اكتشف الأندية والمجالس الطلابية والفعاليات المنشورة في كلية علوم الحاسب والمعلومات بجامعة الإمام محمد بن سعود الإسلامية عبر منصة لُبّ.";
  const alternateNames = en ? ["لُبّ", "Lub", "lub.community"] : ["LUB", "Lub", "lub.community"];
  return <>
    <PublicHeader />
    <JsonLd data={{
      "@context": "https://schema.org",
      "@graph": [
        {
          "@type": "Organization",
          "@id": "https://lub.community/#organization",
          name: "لُبّ",
          alternateName: ["LUB", "Lub", "lub.community"],
          description,
          url: "https://lub.community/",
          logo: "https://lub.community/brand/logo.svg",
        },
        {
          "@type": "WebSite",
          "@id": "https://lub.community/#website",
          url: "https://lub.community/",
          name: en ? "LUB" : "لُبّ",
          alternateName: alternateNames,
          description,
          inLanguage: en ? "en" : "ar",
          publisher: { "@id": "https://lub.community/#organization" },
        },
      ],
    }} />
    <main id="main" className="mx-auto max-w-7xl px-5 pb-16 pt-6 sm:px-8 sm:pb-24 sm:pt-10">
      <section className="home-hero px-6 py-12 sm:px-12 sm:py-16 lg:px-16 lg:py-20">
        <Image src="/brand/symbol-reversed.svg" alt="" width={100} height={100} className="home-hero-mark h-auto" aria-hidden="true" />
        <div className="relative grid gap-12 lg:grid-cols-[minmax(0,1.25fr)_minmax(15rem,.7fr)] lg:items-end lg:gap-16">
          <div>
            <p className="mb-5 text-sm font-medium text-[#bad3e6]">{en ? "Student clubs, councils, and events for CCIS students" : "منصة الأندية والمجالس والفعاليات الطلابية"}</p>
            <h1 className={`max-w-2xl ${en ? "text-[clamp(2.7rem,5vw,4.5rem)] leading-[1.18]" : "text-[clamp(2.7rem,6vw,5.5rem)] leading-[1.22]"}`}>{en ? <>Start here.<br />Make an impact.</> : <>هنا تبدأ مشاركتك،<br />ويظهر أثرها.</>}</h1>
            <p className="mt-6 max-w-xl text-base leading-8 text-[#d8e4ed] sm:text-lg sm:leading-9">{en ? "Discover clubs and councils, take part in what matters to you, and keep a record of your achievements in one place." : "اكتشف الأندية والمجالس، شارك في ما يهمك، واحتفظ بسجل إنجازاتك في مكان واحد."}</p>
            <div className="mt-9 flex flex-wrap items-center gap-5"><Link href="/organizations" className="button button-secondary">{en ? "Explore organizations" : "استكشف الجهات"}</Link><Link href="/ai" className="font-bold text-[#d8e4ed] underline underline-offset-4 hover:text-white">{en ? "Ask LUB" : "اسأل لُبّ"}</Link></div>
          </div>
          <nav aria-label={en ? "Explore" : "مسارات الاستكشاف"} className="relative border-t border-white/25 lg:border-t-0 lg:border-s lg:border-white/25 lg:ps-8">
            <p className="mb-2 pt-5 text-sm text-[#b7ccdc] lg:pt-0">{en ? "Start here" : "ابدأ من هنا"}</p>
            <Link href="/organizations" className="hero-route"><span>{en ? "Clubs and councils" : "الأندية والمجالس"}</span><span aria-hidden="true">↗</span></Link>
            <Link href="/events" className="hero-route"><span>{en ? "Events" : "الفعاليات"}</span><span aria-hidden="true">↗</span></Link>
            <Link href="/talent" className="hero-route"><span>{en ? "Talent" : "المواهب"}</span><span aria-hidden="true">↗</span></Link>
          </nav>
        </div>
      </section>
      <section className="mt-16 sm:mt-20" aria-labelledby="journey-title">
        <div className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-sm font-medium text-action">{en ? "From the first step" : "من أول خطوة"}</p><h2 id="journey-title" className="font-display mt-2 text-3xl sm:text-4xl">{en ? "A clear path for every contribution" : "مسار واضح لكل مشاركة"}</h2></div><p className="max-w-sm leading-7 text-muted">{en ? "From the organization you choose to the impact you want to keep." : "من الجهة التي تختارها إلى الأثر الذي تريد الاحتفاظ به."}</p></div>
        <ol className="mt-8 grid gap-6 md:grid-cols-3 md:gap-10">
          {[
            en ? ["Join", "Find a club or council that matches your interests."] : ["انضم", "تعرّف على النادي أو المجلس الذي يناسب اهتمامك."],
            en ? ["Participate", "Follow tasks and events with your organization and committee."] : ["شارك", "تابع المهام والفعاليات مع جهتك ولجنتك."],
            en ? ["Record", "Review your approved hours, roles, and achievements."] : ["وثّق", "ارجع إلى ساعاتك المعتمدة وأدوارك وإنجازاتك."],
          ].map(([title, description], index) => <li key={title} className="border-t-2 border-[#9db9cd] pt-5">
            <span className="text-sm font-bold text-action" aria-hidden="true">{String(index + 1).padStart(2, "0")}</span>
            <h3 className="mt-4 text-xl font-bold">{title}</h3><p className="mt-2 max-w-sm leading-8 text-muted">{description}</p>
          </li>)}
        </ol>
      </section>
      <section id="about" className="mt-16 border-y border-line py-8 sm:mt-20 sm:py-10" aria-labelledby="about-title">
        <div className="grid gap-4 sm:grid-cols-[minmax(12rem,.7fr)_minmax(0,1.3fr)] sm:gap-10">
          <div>
            <p className="text-sm font-medium text-action">{en ? "A student space" : "مساحة طلابية"}</p>
            <h2 id="about-title" className="font-display mt-2 text-3xl">{en ? "About LUB" : "عن لُبّ"}</h2>
          </div>
          <div className="max-w-3xl">
            <p className="leading-8 text-muted">{en
              ? "LUB (Lub, written لُبّ in Arabic) is a student platform for discovering published clubs, councils, and events for the College of Computer and Information Sciences community at Imam Mohammad Ibn Saud Islamic University. It helps students find ways to participate and keep a record of their achievements."
              : "لُبّ (Lub) مساحة طلابية تساعد طلاب كلية علوم الحاسب والمعلومات بجامعة الإمام محمد بن سعود الإسلامية على اكتشاف الأندية والمجالس والفعاليات المنشورة، والوصول إلى فرص المشاركة والاحتفاظ بسجل الإنجازات."}</p>
            <p className="mt-3 leading-8 text-muted">{en
              ? "Public club, council, and event information can be browsed without an account. Sign in when you choose to apply, register, or use a personal student feature."
              : "تقدر تتصفح معلومات الأندية والمجالس والفعاليات المنشورة بدون حساب. سجّل الدخول عند التقديم أو التسجيل في فعالية أو استخدام إحدى الخدمات الطلابية الشخصية."}</p>
            <a className="text-link mt-4 inline-block" href="https://units.imamu.edu.sa/colleges/ComputerAndInformation/Pages/default.aspx" target="_blank" rel="noopener noreferrer">
              {en ? "Official college website" : "الموقع الرسمي للكلية"}
            </a>
          </div>
        </div>
      </section>
      <section className="privacy-strip mt-16 flex flex-wrap items-center justify-between gap-6 rounded-2xl bg-[#e8f0f6] px-6 py-8 sm:mt-20 sm:px-10" aria-labelledby="privacy-title">
        <div className="max-w-2xl"><h2 id="privacy-title" className="text-xl font-bold sm:text-2xl">{en ? "Choose what you share" : "أنت تختار ما تشاركه"}</h2><p className="mt-2 leading-8 text-muted">{en ? "Your public profile is optional. Your university details stay private, and you control which activities and hours others can see." : "ملفك العام اختياري. بياناتك الجامعية خاصة، وتتحكم في الأنشطة والساعات التي تظهر للآخرين."}</p></div>
        <Link href="/signup" className="text-link">{en ? "Create an account when you need one" : "ابدأ حسابك عندما تحتاجه"}</Link>
      </section>
    </main>
  </>;
}
