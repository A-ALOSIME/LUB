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
