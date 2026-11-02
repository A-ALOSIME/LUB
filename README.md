# لُبّ | LUB

منصة للأندية والمجالس الطلابية: استكشاف الجهات والفعاليات والمواهب للعامة، مع حسابات للعضوية والتقديم وإدارة الأعمال والساعات والمستندات. المشروع قيد التطوير ومتاح على [lub.community](https://lub.community).

## التشغيل المحلي

يتطلب Node.js 22.20 أو أحدث. لا تُضف بيانات الدخول إلى Git؛ انسخ `.env.example` إلى `.env.local` واملأ قيم مشروع Supabase الخاص ببيئة التطوير. الواجهة العامة تعمل دون حساب، لكن تسجيل الدخول والبيانات المحفوظة تحتاج Supabase وقاعدة PostgreSQL والمهاجرات.

```powershell
npm.cmd ci --ignore-scripts
npm.cmd run dev
```

لإعداد قاعدة التطوير، شغّل مهاجرات Drizzle بعد تعبئة `DATABASE_URL` في `.env.local`:

```powershell
npm.cmd run db:migrate
```

فحوص المشروع:

```powershell
npm.cmd run check
npm.cmd run build
npm.cmd audit --audit-level=high
```

## البنية والحالة

- الواجهة ومنطق النظام: Next.js، React، TypeScript، Tailwind CSS، Drizzle، Supabase Auth وStorage.
- التشغيل الحي: Cloudflare Workers عبر vinext/Vite، مع Hyperdrive للاتصال بـ PostgreSQL. إعدادات Cloudflare في `cloudflare.config.ts` وأسرار التشغيل تُدار خارج Git.
- المساعد «اسأل لُبّ»: واجهته منشورة، بينما ربط خدمة الذكاء الاصطناعي المستقلة وتوليد الإجابات لم يكتمل بعد.
- التحقق بالبريد يستخدم رمزًا من ثمانية أرقام في مشروع Supabase الحي. بعض اختبارات تسجيل الدخول والإدارة على الموقع الحي ما زالت قيد العمل.

الكود موزع بين `src` للتطبيق، و`drizzle` للمهاجرات، و`services/ai` لخدمة المراجع العامة، و`tests` للاختبارات. يعمل Docker محليًا كخيار إضافي؛ النشر الحالي على Cloudflare Workers.

مشروع تخرج: أحمد فهد العصيمي وناصر خالد اليمني.

## ترجمة المحتوى العام

عند اختيار الإنجليزية، يترجم `ContentText autoTranslate` محتوى الجهات وأوصافها والفعاليات المنشورة وتفاصيلها والإعلانات واللجان العامة من العربية إلى الإنجليزية فقط. النص العربي الأصلي يبقى محفوظًا ويظهر عند الفشل؛ نصوص الواجهة الثابتة تبقى في i18n. الأسماء الخاصة لُبّ وإنجاز وتكنيشن محمية من الترجمة.

الواجهة تستدعي `/api/translations` من نفس الأصل، ثم دالة Supabase `translate-content`. يُحفظ `DEEPL_API_KEY` في Supabase Secrets فقط ويُقرأ داخل Edge Function؛ لا يوضع في `.env` أو الواجهة أو Git. مفاتيح API Free القديمة ذات اللاحقة `:fx` تستخدم `api-free.deepl.com`، ومفاتيح Developer تستخدم `api.deepl.com`.

طبّق مهاجرة Drizzle `0071_public_content_translations` قبل نشر الدالة:

```powershell
npx --yes supabase@2.122.0 functions deploy translate-content --project-ref rxymldxhcevlwpnutsqy --use-api
```

الكاش الخاص `lub.translations` يستخدم SHA-256 للنص الأصلي مع اللغة الهدف. دوال RPC متاحة لـ `service_role` فقط وتتحقق من أن المصدر محتوى منشور حاليًا؛ لا تقبل نصوص الحسابات أو الطلبات الخاصة. جدول `translation_requests` يضبط الاستهلاك المشترك ويمنع تكرار الطلبات المتزامنة: 60 محاولة في الدقيقة، 50000 حرف في 24 ساعة، وسقف محلي محافظ 1000000 حرف إجمالًا. المحاولة الفاشلة تحتسب ضمن الحماية ولا تكتب ترجمة في الكاش. لا تُرفع هذه الحدود تلقائيًا.

لإيقاف طلبات المزود مؤقتًا دون لمس المفتاح، اضبط السر `DEEPL_TRANSLATION_ENABLED=false`، ثم أعده إلى `true`. الكاش الموجود يظل متاحًا؛ النصوص الجديدة تعود إلى العربية. هذا مفتاح تشغيل للخدمة، ولا يغيّر مفتاح DeepL أو صلاحيات المستخدمين.
