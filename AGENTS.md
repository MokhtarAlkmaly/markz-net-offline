# AGENTS.md — Markz Net (نسخة مستقلة بدون إنترنت)

Markz Net نسخة مستقلة بالكامل من نظام إدارة حلقات ومسابقات القرآن الكريم،
مبنيّة على مستودع Msabka-app الأصلي ومحوّلة للعمل محلياً بدون أي إنترنت أو
خدمات سحابية.

## القاعدة الذهبية

**لا يوجد أي اتصال شبكي في هذا التطبيق.** لا Supabase ولا أي API خارجي.
كل البيانات تعيش على الجهاز:

- **قاعدة البيانات:** SQLite واحدة عبر jeep-sqlite (المتصفح) أو
  @capacitor-community/sqlite (أندرويد) — الاسم `markznet_local`.
- **ملفات الوسائط:** مخزن IndexedDB باسم `markznet_media` (صور/فيديو كـ Blob).
- **الجلسة:** `localStorage` بمفتاح `markznet.session` (تحقق من جدول app_users).

## الهوية (مهمة قبل أي تعديل مرئي)

هذا المشروع هو **Markz Net — نسخة بلا إنترنت**، وهو منفصل تماماً عن تطبيق
«مركز إنماء الأهلي الخيري» السحابي (معرّفه `org.inmaa.msabkarmdan` وقاعدته
`inmaa_local`). لا تخلط بينهما ولا تعد إلى معرّفات التطبيق السابق.

- نصوص الاسم والوسم والترويسات: `src/lib/brand.ts` فقط (لا تكتب «Markz Net» نصّاً
  داخل الصفحات). الشارات: `src/components/OfflineBadge.tsx`.
- الأيقونات والشعار وشاشات البداية تُولَّد بـ `npm run brand:assets`
  (المولّد: `scripts/generate-brand-assets.mjs` والخطوط في `scripts/brand-fonts/`).
- لا تُغيّر `appId` (`net.markz.app`) ولا `DB_NAME` (`markznet_local`) ولا مفاتيح
  `markznet.*` في localStorage — تغييرها يفقد المستخدمين بياناتهم.
- التفاصيل الكاملة: `docs/الهوية-وتمييز-النسختين.md`.

## هوية المركز (اسم + شعار) — لتشغيل التطبيق لأكثر من مركز

- لكل حساب «هوية مركز» يضبطها من: الإعدادات → هوية المركز
  (`src/components/CenterIdentitySettings.tsx`).
- المصدر الواحد للهوية: `src/lib/center-brand.ts` + المزوّد
  `src/hooks/useCenterBrand.tsx`، وتُخزَّن عبر `loadCenterIdentity` /
  `saveCenterIdentity` في `src/utils/storage.ts`
  (مفتاح `<userId>:center_identity`) مع نسخة خفيفة في `localStorage`
  بمفتاح `markznet.centerBrand` لصفحة الدخول (بلا تحميل SQLite قبل الدخول).
- **لا تكتب اسم المركز نصاً** في الصفحات:
  - في React: `const { name, logoUrl, headerLine, identity } = useCenterBrand()`.
  - في قوالب الطباعة (خارج React): `activeCenterPrintTitle()` و
    `activeCenterLogoSrc(logo)` و`activeCenterSupervisorLine()` من
    `@/lib/center-brand` — تقرأ الهوية النشطة المتزامنة التي يحدّثها المزوّد.
    `printHtmlDocument()` يضيف ترويسة تلقائية للقوالب التي لا تملك ترويسة
    خاصة عبر `src/lib/print-branding.ts`؛ لا تكرر الهوية يدوياً في تلك القوالب.
- الدليل: `docs/هوية-المركز-والتخصيص.md`.

## القائمة الجانبية والتخطيط (لا تكرّر نقطة التثبيت)

- نقطة التثبيت **واحدة**: `SIDEBAR_DOCK_BREAKPOINT = 1280` في
  `src/hooks/useSidebarDock.ts` (الخطاف `useSidebarDock()`)، يقرأها
  `src/components/AppSidebar.tsx` و`src/routes/_authenticated/route.tsx`.
- أدنى من 1280px: القائمة **درج** يُغلق باختيار أي صفحة (تأثير على `pathname`)،
  وبمفتاح `Esc`، وبالنقر على الحاجب، وبزر الإغلاق داخلها، وتُعطَّل بـ `inert`
  وهي مخفية. لا تكتب تثبيتاً بـ Tailwind (`md:translate-x-0`, `md:hidden`) —
  الاختبار `npm run test:layout` يفشل إن عادت.
- حجز المساحة شرطي في التخطيط: `${sidebarDocked ? "mr-72" : ""}` (و`w-72` في
  القائمة) — لا `md:mr-72`/`lg:mr-72` في أي ملف.
- مسافات زر الفتح العائم (768–1279px): `pr-12 xl:pr-0` في
  `CenterSectionTabs.tsx` و`pt-16 xl:pt-6` في `ExamQuestions.tsx`، وبطاقات ملخص
  الإعدادات `xl:grid-cols-4`.
- اختبار الانحدار يبني القائمة والتخطيط الحقيقيين ويشغّلهما فوق DOM (jsdom) —
  البدائل (auth/router/brand) تُعرَّف داخل `scripts/test-layout.mjs` فقط.

## البنية المحلية

| الملف                             | الدور                                                                   |
| --------------------------------- | ----------------------------------------------------------------------- |
| `src/utils/sqliteClient.ts`       | فتح القاعدة + المخطط الكامل (كل الجداول مع `user_id`)                   |
| `src/utils/localDB.ts`            | طبقة CRUD فوق SQLite (كاش + استعلامات مفلترة بالمستخدم)                 |
| `src/utils/localAuth.ts`          | مصادقة محلية (PBKDF2) — أول حساب يصبح admin                             |
| `src/utils/users.ts`              | إدارة المستخدمين والصلاحيات ومنح الاطلاع                                |
| `src/utils/storage.ts`            | واجهة البيانات للصفحات (كانت سحابية — صارت محلية بالكامل)               |
| `src/utils/studentExcelImport.ts` | استيراد Excel للسجل الشامل (مطابقة بالاسم + الأعوام + الأعمدة المخصصة)  |
| `src/utils/accountBackup.ts`      | نسخة JSON لبيانات الحساب (16 جدولاً + إعدادات + وسائط؛ بلا حسابات دخول) |
| `src/utils/teacherPortal.ts`      | روابط المعلمين/المعلمات + وارد الترسيلات الشهرية                        |
| `src/utils/mediaStore.ts`         | متجر وسائط IndexedDB                                                    |
| `src/utils/viewAs.ts`             | وضع "الاطلاع على بيانات مستخدم آخر" (قراءة فقط)                         |
| `src/utils/communityStorage.ts`   | سجل المجتمع (أقسام الرعاية/التدريب) — محلي بالكامل                      |
| `src/utils/examStorage.ts`        | بنك أسئلة الاختبارات — محلي بالكامل                                     |
| `src/utils/quranText.ts`          | نص المصحف من أصل ثابت `public/quran/uthmani.json` (بلا نت)              |
| `src/hooks/useSidebarDock.ts`     | نقطة تثبيت القائمة الجانبية (1280px) — مصدر واحد                        |
| `src/lib/center-brand.ts`         | هوية المركز (اسم/إشراف/شعار) + ذاكرة قوالب الطباعة                      |
| `src/lib/print-branding.ts`       | يضيف هوية الحساب تلقائياً لقوالب الطباعة غير المعرّفة                   |
| `src/hooks/useCenterBrand.tsx`    | مزوّد الهوية لكل الواجهة (`useCenterBrand`)                             |

ميزات منقولة من المستودع الأصلي (بنسخة محلية خالصة): سجل المعلمين والمعلمات
العام بتبويباته (`src/components/teachers/`)، الأسئلة والاختبارات
(`src/components/exam/` + `src/utils/examPaperGenerator.ts`)، المتأخرات
والتنبيهات (`src/pages/OverdueAlerts.tsx` + `src/lib/overdue-alerts.ts`)،
وأقسام المركز (`src/pages/CenterDepartment.tsx` + `src/components/CommunityRegistry.tsx`).
جدولا `community_records` و`exam_questions` مضافان للمخطط مع عزل `user_id`
وضمن `deleteAllRowsForUser`.

## استيراد السجل الشامل من Excel

- صفحة الطلاب (`/students`): استيراد/تصدير Excel + قالب وإرشادات.
- المنطق في `src/utils/studentExcelImport.ts` (بلا اعتماد على xlsx — القراءة
  في الواجهة عبر `loadXLSX`): المفتاح اسم الطالب بعد التطبيع
  (`normalizeStudentName`)، الموجود يُحدَّث والجديد يُنشأ، والفراغ لا يدهس
  القيمة الحالية، وأعوام العمود «الأعوام المسجل بها» تُسجَّل في `year_data`
  (ذو الحجة بصيغة `1447D`) والحفظ التراكمي يُكتب في آخر عام بالملف.
- الدليل: `docs/استيراد-السجل-الشامل-Excel.md`، والاختبارات ضمن
  `npm run test:integration`.

## النسخ الاحتياطي والاستعادة

- البطاقة في الإعدادات، والمنطق في `src/utils/accountBackup.ts`.
- ملف JSON واحد يحوي جداول البيانات الستة عشر، إعدادات الحساب، ووسائطه كـ Blob؛
  لا يتضمن `app_users` أو كلمات المرور أو أذونات الاطلاع أو بيانات المزامنة القديمة.
- الاستعادة دمج فقط بعد معاينة: الطالب المطابق بالاسم المطبّع تُملأ فراغاته وتُعاد
  ربط صفوفه بمعرّفه المحلي؛ الجداول الأخرى والوسائط تُزال تكراراتها بمفاتيح طبيعية.
  لا تُحذف ولا تُستبدل قيمة غير فارغة، وتُرفض الاستعادة في وضع الاطلاع.
- الدليل: `docs/نسخ-احتياطي-واستعادة.md`؛ الاختبار `npm run test:backup`.

## عزل بيانات المستخدمين

كل جدول بيانات يحمل عمود `user_id`، وكل قراءة/كتابة تُفلتر به. حذف قاعدة
بيانات مستخدم (`deleteEntireDatabase` → `deleteAllRowsForUser`) يمسح صفوفه
فقط ويُبقي حسابات الآخرين. الإعدادات تُخزَّن ب مفاتيح مقيدة:
`${userId}:active_year` إلخ.

## الأوامر

```bash
npm install          # تثبيت (ينفّذ copy-sqlite-wasm.mjs تلقائياً)
npm run dev          # تطوير
npm run build        # بناء الإنتاج (خادم node-server في .output/)
npm start            # تشغيل خادم الإنتاج: node .output/server/index.mjs
npm run lint         # ESLint
npx tsc --noEmit     # فحص الأنواع
npm run test:db      # اختبار القاعدة المحلية (sql.js)
npm run test:integration  # اختبارات تكاملية: مصادقة/صلاحيات/عزل/بوابة معلمين
npm run test:connection   # انحدار: اعتماد اتصال أصلي موجود (قفلة already exists)
npm run test:layout       # انحدار: تثبيت القائمة من 1280px + إغلاق الدرج عند الاختيار
npm run test:backup       # النسخ الاحتياطي والاستعادة: الدمج وإعادة الربط وعدم التكرار
```

## عند التعديل

- لا تستورد أي شيء من `@/integrations` — الحزمة حُذفت نهائياً.
- `syncToCloud` في storage.ts أصبحت no-op للتوافق؛ لا تضف منطقاً سحابياً.
- `markDirty` no-op أيضاً — لا "تغييرات معلقة" بعد الآن.
- بعد أي تعديل شامل شغّل: `npx prettier --write` على الملفات المعدلة ثم
  `npm run lint` (العربية وحساسية المسافات).
- المعرفات المحلية: الطلاب بتسلسل طبيعي يبدأ من 1، والكيانات الأخرى UUID.

## ملاحظات

- الرسم من UMD عبر .lovable محذوف؛ البناء عبر @lovable.dev/vite-tanstack-config
  مع `nitro: { preset: "node-server" }` دائماً.
- التطبيق أحادي الخادم: تشغيله على جهاز واحد يخدم الشبكة المحلية عبر
  `HOSTNAME=0.0.0.0 PORT=8080 npm start` — كل متصفح يحتفظ ببياته محلياً
  (IndexedDB خاص بالمتصفح)، والمشاركة الكاملة عبر منح الاطلاع تعمل داخل
  نفس المتصفح/الجهاز، أو عبر تطبيق أندرويد لجهاز واحد.
