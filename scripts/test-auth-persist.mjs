/**
 * اختبار انحدار لعلّة «إنشاء حساب المسؤول يعيد شاشة الإعداد من جديد»:
 * كانت كتابات جدول app_users (إنشاء حساب/تغيير كلمة مرور/ترقية دور) لا تصل
 * إلى المخزن الدائم أبدًا، وبعد إعادة التحميل following تنقّل كامل تُفتح قاعدة
 * فارغة فيعود التطبيق لشاشة إعداد المسؤول ولا يبقى إلا البريد المحفوظ.
 *
 * يحاكي الاختبار إعادة تحميل الصفحة باستيراد نسخة جديدة من الحزمة فوق نفس
 * المخزن الدائم (ستُبّ sqliteClient في test-harness.mjs يحاكي مخزن IndexedDB).
 *
 *   node scripts/test-auth-persist.mjs
 */

import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildTestBundle, installBrowserShim, createTestRunner } from "./test-harness.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

installBrowserShim();

const outfile = await buildTestBundle({
  stdinSource: `
export * from ${JSON.stringify(path.join(ROOT, "src/utils/localAuth.ts"))};
export * as users from ${JSON.stringify(path.join(ROOT, "src/utils/users.ts"))};
`,
  outfile: path.join(ROOT, ".output/tests/test-auth-persist.mjs"),
});

const { ok, finish } = createTestRunner();
console.log("اختبار بقاء الحسابات بعد إعادة التحميل (انحدار شاشة إعداد المسؤول)\n");

const ADMIN_EMAIL = "admin@markz.test";
const ADMIN_PASS = "admin-pass-123";
const ADMIN_PASS_NEW = "admin-pass-456";
const USER_EMAIL = "teacher@markz.test";
const USER_PASS = "teacher-pass-123";

// ===== «الزيارة الأولى»: لا حسابات — إعداد المسؤول =====
const visit1 = await import(outfile);
let adminId = null;
let userId = null;

await ok("أول تشغيل: لا حسابات على الجهاز", async () => {
  if ((await visit1.hasAnyUsers()) !== false) throw new Error("المفروض ألا توجد حسابات");
});

await ok("إنشاء حساب المسؤول الأول", async () => {
  const admin = await visit1.signUp({
    email: ADMIN_EMAIL,
    password: ADMIN_PASS,
    displayName: "المسؤول",
  });
  adminId = admin.id;
  if (!admin.is_admin) throw new Error("أول حساب يجب أن يصبح مسؤولًا");
});

// ===== محاكاة إعادة تحميل كاملة للصفحة (سياق جافاسكربت جديد) =====
const visit2 = await import(`${outfile}?reload=1`);

await ok("بعد إعادة التحميل: الحساب موجود ولا تعود شاشة الإعداد", async () => {
  if ((await visit2.hasAnyUsers()) !== true)
    throw new Error("اختفى الحساب بعد إعادة التحميل — سيعود التطبيق لشاشة إعداد المسؤول");
});

await ok("بعد إعادة التحميل: تسجيل الدخول بنفس كلمة المرور يعمل", async () => {
  const me = await visit2.signIn(ADMIN_EMAIL, ADMIN_PASS);
  if (me.id !== adminId) throw new Error("جلسة لحساب مختلف");
  if (!me.is_admin) throw new Error("فقدت صلاحية المسؤول بعد إعادة التحميل");
});

await ok("إنشاء حساب ثانٍ وتغيير كلمة المرور وترقية الدور", async () => {
  const second = await visit2.signUp({
    email: USER_EMAIL,
    password: USER_PASS,
    displayName: "معلمة",
  });
  userId = second.id;
  if (second.is_admin) throw new Error("الحساب الثاني لا يجب أن يكون مسؤولًا");
  await visit2.changeOwnPassword(ADMIN_PASS, ADMIN_PASS_NEW);
  await visit2.users.setUserRole(userId, true);
});

// ===== محاكاة إعادة تحميل ثانية =====
const visit3 = await import(`${outfile}?reload=2`);

await ok("بعد إعادة تحميل ثانية: كلمة المرور الجديدة هي المعتمدة", async () => {
  await visit3.signIn(ADMIN_EMAIL, ADMIN_PASS).then(
    () => {
      throw new Error("الكلمة القديمة ما زالت تعمل — التغيير لم يُحفظ");
    },
    () => undefined, // متوقع: الكلمة القديمة لم تعد صالحة
  );
  const me = await visit3.signIn(ADMIN_EMAIL, ADMIN_PASS_NEW);
  if (me.id !== adminId) throw new Error("جلسة لحساب مختلف");
});

await ok("بعد إعادة تحميل ثانية: ترقية الدور محفوظة", async () => {
  const listed = await visit3.listAuthUsers();
  const promoted = listed.find((u) => u.id === userId);
  if (!promoted) throw new Error("الحساب الثاني اختفى بعد إعادة التحميل");
  if (!promoted.is_admin) throw new Error("ترقية الدور لم تُحفظ");
});

finish("اختبار بقاء الحسابات");
