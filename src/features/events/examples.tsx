import Link from "next/link";
import Image from "next/image";
import type {Locale} from "@/lib/preferences";
import {EventIcon} from "./icon";

type LocalizedText = {ar: string; en: string};
type ExampleIcon = "calendar" | "clock" | "location" | "users" | "person" | "certificate" | "target" | "list" | "book" | "checklist";
type EventExampleData = {
  id: string;
  organization: LocalizedText;
  organizationLogo: string;
  title: LocalizedText;
  cardTitleLines?: LocalizedText[];
  dateLabel: LocalizedText;
  date: LocalizedText;
  cardDateLines?: LocalizedText[];
  image: string;
  imageAlt: LocalizedText;
  imageWidth: number;
  imageHeight: number;
  theme: "cybersec" | "ieee" | "oss";
  facts: {label: LocalizedText; value: LocalizedText; icon: ExampleIcon}[];
  sections: {title: LocalizedText; items: LocalizedText[]; icon: ExampleIcon}[];
};

export const eventExamples: readonly EventExampleData[] = [
  {
    id: "cybersec",
    organization: {ar: "نادي الأمن السيبراني", en: "CyberSec Club"},
    organizationLogo: "/club-logos/cybersec-avatar.webp",
    title: {ar: "اكتشف مسارك المهني في الأمن السيبراني مع CompTIA", en: "Explore a Cybersecurity Career with CompTIA"},
    dateLabel: {ar: "موعد الفعالية", en: "Event date"},
    date: {ar: "موعد الفعالية غير مذكور", en: "Event date not listed"},
    image: "/event-posters/cybersec-comptia-workshop.webp",
    imageAlt: {ar: "بوستر ورشة CompTIA عن المسارات المهنية في الأمن السيبراني ومحاورها.", en: "CompTIA workshop poster about cybersecurity career paths and topics."},
    imageWidth: 1080,
    imageHeight: 1080,
    theme: "cybersec",
    facts: [
      {label: {ar: "الفئة المستهدفة", en: "Audience"}, value: {ar: "طلاب وطالبات جامعة الإمام محمد بن سعود الإسلامية", en: "Students at Imam Mohammad Ibn Saud Islamic University"}, icon: "users"},
      {label: {ar: "إعداد وتقديم", en: "Presented by"}, value: {ar: "أحمد الأسمري ويزيد أباني", en: "Ahmed Alasmari and Yazeed Abani"}, icon: "person"},
    ],
    sections: [
      {
        title: {ar: "أهداف الورشة", en: "Workshop goals"},
        icon: "target",
        items: [
          {ar: "التوعية بأهمية الشهادات المهنية في الأمن السيبراني.", en: "Explain the value of professional cybersecurity certifications."},
          {ar: "استعراض مسارات الشهادات ودورها في بناء المسار المهني.", en: "Explore certification paths and how they support a cybersecurity career."},
        ],
      },
      {
        title: {ar: "محاور الورشة", en: "Workshop topics"},
        icon: "list",
        items: [
          {ar: "كيف تبدأ مسارك الاحترافي في الأمن السيبراني.", en: "How to start a professional cybersecurity career."},
          {ar: "الشهادات العالمية المطلوبة في سوق العمل.", en: "Cybersecurity certifications sought in the job market."},
          {ar: "آلية التقديم على دعم هدف.", en: "How to apply for HRDF support."},
          {ar: "خطوات حجز اختبار الشهادة.", en: "How to book a certification exam."},
        ],
      },
    ],
  },
  {
    id: "ieee",
    organization: {ar: "نادي IEEE", en: "IEEE Student Branch"},
    organizationLogo: "/club-logos/ieee.webp",
    title: {ar: "معسكر علم البيانات", en: "Data Science Camp"},
    dateLabel: {ar: "موعد المعسكر", en: "Camp dates"},
    date: {ar: "الأحد 15 سبتمبر • 5 أيام", en: "Sunday, 15 September • 5 days"},
    cardDateLines: [
      {ar: "الأحد 15 سبتمبر", en: "Sunday, 15 September"},
      {ar: "5 أيام", en: "5 days"},
    ],
    image: "/event-posters/ieee-data-science-camp.jpg",
    imageAlt: {ar: "بوستر معسكر IEEE لعلم البيانات، ويعرض محاور التدريب ومتطلبات المشاركة.", en: "IEEE data science camp poster with its curriculum and participation requirements."},
    imageWidth: 800,
    imageHeight: 1127,
    theme: "ieee",
    facts: [
      {label: {ar: "الوقت", en: "Time"}, value: {ar: "3:40–6:40 مساءً يوميًا", en: "3:40–6:40 PM daily"}, icon: "clock"},
      {label: {ar: "الموقع", en: "Location"}, value: {ar: "مبنى المؤتمرات في الجامعة", en: "University Conference Building"}, icon: "location"},
      {label: {ar: "الفئة المستهدفة", en: "Audience"}, value: {ar: "طلاب وطالبات الجامعة", en: "University students"}, icon: "users"},
      {label: {ar: "الشهادة", en: "Certificate"}, value: {ar: "شهادة معتمدة من كلية علوم الحاسب والمعلومات", en: "Certificate approved by the College of Computer and Information Sciences"}, icon: "certificate"},
    ],
    sections: [
      {
        title: {ar: "برنامج المعسكر", en: "Camp curriculum"},
        icon: "book",
        items: [
          {ar: "اليوم 1: NumPy", en: "Day 1: NumPy"},
          {ar: "اليوم 2: Pandas", en: "Day 2: Pandas"},
          {ar: "اليوم 3: Matplotlib وSeaborn", en: "Day 3: Matplotlib and Seaborn"},
          {ar: "اليوم 4: تحليل البيانات الاستكشافي (EDA)", en: "Day 4: Exploratory Data Analysis (EDA)"},
          {ar: "اليوم 5: مقدمة في تعلم الآلة", en: "Day 5: Machine Learning overview"},
        ],
      },
      {
        title: {ar: "متطلبات المشاركة", en: "Requirements"},
        icon: "checklist",
        items: [
          {ar: "معرفة أساسية بلغة Python.", en: "Basic Python knowledge."},
          {ar: "إحضار جهاز لابتوب.", en: "Bring a laptop."},
          {ar: "معرفة أولية بالإحصاء والاحتمالات.", en: "Introductory statistics and probability knowledge."},
        ],
      },
    ],
  },
  {
    id: "oss",
    organization: {ar: "مجتمع OSS", en: "OSS Vision Community"},
    organizationLogo: "/club-logos/oss-vision-community-centered-lowered.webp",
    title: {ar: "معسكر علم البيانات: من التحليل إلى تعلم الآلة", en: "Data Science Camp: From Analysis to Machine Learning"},
    cardTitleLines: [
      {ar: "معسكر علم البيانات:", en: "Data Science Camp:"},
      {ar: "من التحليل إلى تعلم الآلة", en: "From Analysis to Machine Learning"},
    ],
    dateLabel: {ar: "التواريخ المذكورة في الإعلان", en: "Dates listed on the poster"},
    date: {ar: "الطلاب 12–16 أبريل • الطالبات 26–30 أبريل", en: "Male students 12–16 April • female students 26–30 April"},
    cardDateLines: [
      {ar: "الطلاب: 12–16 أبريل", en: "Male students: 12–16 April"},
      {ar: "الطالبات: 26–30 أبريل", en: "Female students: 26–30 April"},
    ],
    image: "/event-posters/oss-data-science-camp.webp",
    imageAlt: {ar: "بوستر معسكر OSS لعلم البيانات، ويعرض المحاور ومتطلبات المشاركة.", en: "OSS data science camp poster with its topics and participation requirements."},
    imageWidth: 905,
    imageHeight: 1280,
    theme: "oss",
    facts: [
      {label: {ar: "الوقت", en: "Time"}, value: {ar: "4:30–7:30 مساءً", en: "4:30–7:30 PM"}, icon: "clock"},
      {label: {ar: "الموقع", en: "Location"}, value: {ar: "مبنى المؤتمرات في جامعة الإمام محمد بن سعود", en: "Conference Building at Imam Mohammad Ibn Saud Islamic University"}, icon: "location"},
      {label: {ar: "المقدم", en: "Instructor"}, value: {ar: "الأستاذ عمر السريع", en: "Omar Al-Surai"}, icon: "person"},
    ],
    sections: [
      {
        title: {ar: "محاور المعسكر", en: "Camp topics"},
        icon: "list",
        items: [
          {ar: "أساسيات تحليل البيانات باستخدام NumPy وPandas وMatplotlib.", en: "Data analysis fundamentals with NumPy, Pandas, and Matplotlib."},
          {ar: "تحليل البيانات الاستكشافي (EDA).", en: "Exploratory Data Analysis (EDA)."},
          {ar: "المعالجة المسبقة للبيانات وهندسة الخصائص.", en: "Data preprocessing and feature engineering."},
          {ar: "خوارزميات تعلم الآلة.", en: "Machine learning algorithms."},
        ],
      },
      {
        title: {ar: "متطلبات المعسكر", en: "Requirements"},
        icon: "checklist",
        items: [
          {ar: "إحضار لابتوب.", en: "Bring a laptop."},
          {ar: "الإلمام بلغة Python.", en: "Basic Python knowledge."},
          {ar: "إنجاز المشروع النهائي.", en: "Complete the final project."},
          {ar: "حضور ما لا يقل عن 80% من أيام المعسكر.", en: "Attend at least 80% of camp days."},
        ],
      },
      {
        title: {ar: "التواريخ المذكورة في البوستر", en: "Dates listed on the poster"},
        icon: "calendar",
        items: [
          {ar: "الطلاب: من 12 إلى 16 أبريل.", en: "Male students: 12–16 April."},
          {ar: "الطالبات: من 26 إلى 30 أبريل.", en: "Female students: 26–30 April."},
        ],
      },
    ],
  },
] ;

export type EventExample = EventExampleData;
export const getEventExample = (slug: string) => eventExamples.find(example => example.id === slug);

export function EventExampleDetail({example, locale}: {example: EventExample; locale: Locale}) {
  const en = locale === "en";
  const text = (value: LocalizedText) => en ? value.en : value.ar;

  return <article className={`panel event-example-detail event-example-detail--${example.theme}`} dir={en ? "ltr" : "rtl"}>
    <figure className={`event-example-detail-art event-example-detail-art--${example.theme}`}>
      <div className="event-example-detail-art-frame">
        <Image src={example.image} alt={text(example.imageAlt)} width={example.imageWidth} height={example.imageHeight} sizes="(min-width: 72rem) 34rem, (min-width: 48rem) 45vw, 100vw" unoptimized loading="eager"/>
      </div>
    </figure>
    <div className="event-example-detail-copy" dir={en ? "ltr" : "rtl"}>
      <header className="event-example-detail-heading">
        <div className="event-example-detail-organization">
          <span className="event-example-detail-organization-mark"><Image src={example.organizationLogo} alt="" width={72} height={72} unoptimized/></span>
          <span className="event-example-detail-organization-copy">
            <span>{en ? "Organized by" : "تنظمها"}</span>
            <bdi>{text(example.organization)}</bdi>
          </span>
        </div>
        <h1 dir="auto" className="event-example-detail-title">{text(example.title)}</h1>
      </header>

      <section className="event-example-application" aria-labelledby="event-example-application-title">
        <h2 id="event-example-application-title">{en ? "Registration" : "التسجيل"}</h2>
        <button type="button" disabled aria-describedby="event-example-application-note" className="button event-example-application-button">
          {en ? "Apply for this event" : "التقديم على الفعالية"}
        </button>
        <p id="event-example-application-note">{en ? "Applications are not available for this event." : "التقديم غير متاح لهذه الفعالية."}</p>
      </section>
    </div>

    <div className="event-example-detail-information">
      <dl className="event-example-detail-meta">
        <div>
          <dt><EventIcon name="calendar"/>{text(example.dateLabel)}</dt>
          <dd>{text(example.date)}</dd>
        </div>
        {example.facts.map((fact, index) => <div key={`${fact.label.en}-${index}`}>
          <dt><EventIcon name={fact.icon}/>{text(fact.label)}</dt>
          <dd>{text(fact.value)}</dd>
        </div>)}
      </dl>

      <div className="event-example-detail-sections">
        {example.sections.map((section, index) => {
          const headingId = `event-example-${example.id}-section-${index}`;
          return <section key={section.title.en} className="event-example-detail-section" aria-labelledby={headingId}>
            <h2 id={headingId}><EventIcon name={section.icon}/>{text(section.title)}</h2>
            <ul>{section.items.map(item => <li key={item.en}>{text(item)}</li>)}</ul>
          </section>;
        })}
      </div>
    </div>
  </article>;
}

export function EventExamples({locale}: {locale: Locale}) {
  const en = locale === "en";
  const text = (value: LocalizedText) => en ? value.en : value.ar;

  return <section className="event-examples-section" aria-label={en ? "Student organization events" : "فعاليات الأندية"}>
    <ul className="event-examples-grid">
      {eventExamples.map(example => <li key={example.id}>
        <Link href={`/events/examples/${example.id}`} className={`panel event-example-card event-example-card--${example.theme}`}>
          <div className={`event-example-poster event-example-poster--${example.theme}`}>
            <Image src={example.image} alt={text(example.imageAlt)} width={example.imageWidth} height={example.imageHeight} sizes="(max-width: 40rem) 100vw, (max-width: 80rem) 50vw, 33vw" unoptimized loading="lazy"/>
          </div>
          <div className="event-example-copy">
            <h3 className="event-example-title" dir="auto">{example.cardTitleLines ? example.cardTitleLines.map(line => <span className="block" key={line.ar}>{text(line)}</span>) : text(example.title)}</h3>
            <p className="event-example-date"><EventIcon name="calendar"/><span>{example.cardDateLines ? example.cardDateLines.map(line => <span className="block" key={line.ar}>{text(line)}</span>) : text(example.date)}</span></p>
            <div className="event-example-club" dir="auto">
              <span className="event-example-club-logo"><Image src={example.organizationLogo} alt="" width={48} height={48} unoptimized/></span>
              <span>{text(example.organization)}</span>
            </div>
          </div>
        </Link>
      </li>)}
    </ul>
  </section>;
}
