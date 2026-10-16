/**
 * اختبار النسخ الاحتياطي والاستعادة فوق مخطط SQLite الحقيقي وBlob mediaStore.
 *
 *   npm run test:backup
 */

import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildTestBundle, installBrowserShim, createTestRunner } from "./test-harness.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
installBrowserShim();

const outfile = await buildTestBundle({
  stdinSource: `
export * from ${JSON.stringify(path.join(ROOT, "src/utils/accountBackup.ts"))};
export { signUp, signIn, listAuthUsers } from ${JSON.stringify(path.join(ROOT, "src/utils/localAuth.ts"))};
export { setViewAs } from ${JSON.stringify(path.join(ROOT, "src/utils/viewAs.ts"))};
export { getDB } from "@/utils/sqliteClient";
export { __clearMediaFilesForTests, __getMediaFilesForTests, putMediaFile } from "@/utils/mediaStore";
`,
  outfile: path.join(ROOT, ".output/tests/test-backup.mjs"),
});

const app = await import(outfile);
const { ok, finish } = createTestRunner();
const OWNER_EMAIL = "backup-owner@markz.test";
const TARGET_EMAIL = "backup-target@markz.test";
const PASSWORD = "backup-pass-123";
const STAMP = "2026-10-16T12:00:00.000Z";

const owner = await app.signUp({
  email: OWNER_EMAIL,
  password: PASSWORD,
  displayName: "مالك النسخة",
});
await app.signIn(OWNER_EMAIL, PASSWORD);
const ownerId = owner.id;
const db = await app.getDB();
const insert = async (table, row) => {
  const columns = Object.keys(row);
  await db.run(
    `INSERT INTO ${table} (${columns.join(", ")}) VALUES (${columns.map(() => "?").join(", ")})`,
    columns.map((column) => row[column]),
    true,
  );
};

const sourceStudent = {
  id: 11,
  name: "أَحْمَد مُحَمَّد",
  teacher: "معلم من المصدر",
  user_id: ownerId,
  gender: "male",
  hijri_join_date: "1445-01-01",
  initial_hifz: "2",
  first_competition_year: "1446",
  status: "منتظم",
  school_grade: "السادس",
  guardian_phone: "777111",
  student_phone: "777222",
  custom_fields: JSON.stringify({ old: "قيمة المصدر", empty: "معلومة مستعادة" }),
  notes: "ملاحظة من النسخة",
};

await insert("students", sourceStudent);
await insert("students", {
  ...sourceStudent,
  id: 99,
  name: "بيانات حساب آخر",
  user_id: "other-account",
});
await insert("hifz_history", { student_id: 11, year_key: "h1447", value: "5" });
await insert("hifz_history", { student_id: 99, year_key: "h1447", value: "99" });
await insert("year_data", {
  student_id: 11,
  year: "1447",
  base_hifz: "2",
  total_hifz: "7",
  parts: "5",
  annual: "20",
  recitation: "18",
  memorization: "17",
  total: "55",
  grade: "جيد جداً",
  prize: "",
  status_prize: "",
  rank: "2",
  teacher: "معلم من المصدر",
});
await insert("teachers", {
  id: "teacher-source",
  user_id: ownerId,
  year: "1447",
  name: "المعلم الأول",
  created_at: STAMP,
  updated_at: STAMP,
});
await insert("teacher_bonuses", {
  id: "bonus-source",
  user_id: ownerId,
  teacher_name: "المعلم الأول",
  year: "1447",
  month: 2,
  amount: 12000,
  created_at: STAMP,
  updated_at: STAMP,
});
await insert("donors", {
  id: "donor-source",
  user_id: ownerId,
  year: "1447",
  name: "عبد الله",
  donor_type: "فرد",
  phone: "777",
  pledged_amount: 50000,
  paid_amount: 25000,
  in_kind: null,
  notes: "داعم سنوي",
  created_at: STAMP,
  updated_at: STAMP,
});
await insert("donors", {
  id: "donor-new-source",
  user_id: ownerId,
  year: "1447",
  name: "مؤسسة النور",
  donor_type: "مؤسسة",
  phone: "888",
  pledged_amount: 70000,
  paid_amount: 0,
  in_kind: null,
  notes: null,
  created_at: STAMP,
  updated_at: STAMP,
});
await insert("awards", {
  id: "award-source",
  user_id: ownerId,
  year: "1447",
  recipient_type: "student",
  recipient_name: "أحمد محمد",
  award_type: "حفظ",
  award_kind: "نقدي",
  amount: 5000,
  item: null,
  student_name: "أحمد محمد",
  notes: null,
  awarded_at: "1447-02-01",
  funded_by: "الداعمون",
  created_at: STAMP,
  updated_at: STAMP,
});
await insert("ceremony_expenses", {
  id: "expense-source",
  user_id: ownerId,
  year: "1447",
  category: "ضيافة",
  description: "وجبات الحفل",
  amount: 3000,
  spent_at: "1447-02-01",
  funded_by: null,
  notes: null,
  created_at: STAMP,
  updated_at: STAMP,
});
await insert("certificates", {
  id: "certificate-source",
  user_id: ownerId,
  year: "1447",
  recipient_type: "student",
  recipient_name: "أحمد محمد",
  cert_type: "تقدير",
  title: "إتمام جزء",
  notes: null,
  issued_at: "1447-02-01",
  created_at: STAMP,
  updated_at: STAMP,
});
await insert("internal_competitions", {
  id: "internal-source",
  user_id: ownerId,
  student_id: 11,
  student_name: "أحمد محمد",
  year: "1447",
  competition_name: "المسابقة السنوية",
  category: "خمسة أجزاء",
  score: 90,
  rank: "الأول",
  prize: "جائزة",
  notes: null,
  date: "1447-02-01",
  created_at: STAMP,
  updated_at: STAMP,
});
await insert("external_competitions", {
  id: "external-source",
  user_id: ownerId,
  student_id: 11,
  student_name: "أحمد محمد",
  year: "1447",
  competition_name: "مسابقة المحافظة",
  organizer: "مكتب الأوقاف",
  category: "خمسة أجزاء",
  score: 88,
  rank: "الثاني",
  prize: "شهادة",
  notes: null,
  date: "1447-03-01",
  created_at: STAMP,
  updated_at: STAMP,
});
await insert("monthly_tracking", {
  user_id: ownerId,
  student_id: 11,
  year: "1447",
  month: 2,
  memorization_from_surah: 1,
  memorization_from_ayah: 1,
  memorization_to_surah: 2,
  memorization_to_ayah: 10,
  memorization_hifz_score: 20,
  memorization_recitation_score: 18,
  review_from_surah: 1,
  review_from_ayah: 1,
  review_to_surah: 1,
  review_to_ayah: 100,
  review_hifz_score: 20,
  review_recitation_score: 18,
  attendance_score: 9,
  behavior_score: 8,
});
await insert("teacher_portals", {
  id: "portal-source",
  user_id: ownerId,
  teacher_name: "المعلم الأول",
  code: "abcdefgh",
  year: "1447",
  month: 2,
  active: 1,
  created_at: STAMP,
  updated_at: STAMP,
});
await insert("monthly_submissions", {
  id: "submission-source",
  user_id: ownerId,
  portal_id: "portal-source",
  code: "abcdefgh",
  student_id: 11,
  student_name: "أحمد محمد",
  year: "1447",
  month: 2,
  memorization_from_surah: 1,
  memorization_from_ayah: 1,
  memorization_to_surah: 2,
  memorization_to_ayah: 10,
  memorization_hifz_score: 20,
  memorization_recitation_score: 18,
  review_from_surah: 1,
  review_from_ayah: 1,
  review_to_surah: 1,
  review_to_ayah: 100,
  review_hifz_score: 20,
  review_recitation_score: 18,
  attendance_score: 9,
  behavior_score: 8,
  notes: "ترسيل تجريبي",
  status: "approved",
  source: "portal",
  teacher_name: "المعلم الأول",
  review_note: null,
  reviewed_at: STAMP,
  created_at: STAMP,
  updated_at: STAMP,
});
await insert("community_records", {
  id: "community-source",
  user_id: ownerId,
  department: "care",
  program_id: "cash-assistance",
  beneficiary_name: "أسرة تجريبية",
  beneficiary_type: "family",
  phone: "111222",
  guardian_name: null,
  address: "إب",
  service_date: "2026-10-01",
  status: "completed",
  group_name: null,
  sponsor_name: "الداعمون",
  amount: 15000,
  currency: "YER",
  quantity: null,
  notes: "مساعدة",
  created_at: STAMP,
  updated_at: STAMP,
});
await insert("exam_questions", {
  id: "question-source",
  user_id: ownerId,
  year: "1447",
  category: "حفظ",
  subject: "جزء عم",
  question_type: "written",
  question: "اذكر اسم السورة التي تبدأ بالحمد لله؟",
  choices: "[]",
  correct_answer: null,
  difficulty: "متوسط",
  notes: null,
  created_at: STAMP,
  updated_at: STAMP,
});
await insert("settings", { key: `${ownerId}:active_year`, value: JSON.stringify("1447") });
await insert("settings", { key: "other-account:active_year", value: JSON.stringify("1446") });

await app.__clearMediaFilesForTests();
const sourceBlob = new Blob([new Uint8Array([0, 1, 2, 255, 10])], { type: "image/png" });
await app.putMediaFile(`${ownerId}/photo.png`, sourceBlob);
await insert("media", {
  id: "media-source",
  user_id: ownerId,
  year: "1447",
  month: 2,
  title: "صورة الحفل",
  file_path: `${ownerId}/photo.png`,
  file_type: "image",
  file_size: sourceBlob.size,
  created_at: STAMP,
});

let backup;
let target;
let targetId;

await ok("التصدير يعزل الحساب ويشمل 16 جدولاً والإعدادات والوسائط دون حسابات الدخول", async () => {
  backup = await app.createAccountBackup();
  if (Object.keys(backup.tables).length !== 16)
    throw new Error("يجب أن يحتوي الملف 16 جدول بيانات");
  if (backup.tables.students.length !== 1 || backup.tables.students[0].id !== 11) {
    throw new Error("التصدير تضمن طالباً من حساب آخر أو فقد بيانات المالك");
  }
  if (backup.tables.hifz_history.length !== 1 || backup.tables.hifz_history[0].student_id !== 11) {
    throw new Error("سجل الحفظ لم يُعزل بحسب مالك الطالب");
  }
  if (backup.accountSettings.length !== 1 || backup.accountSettings[0].key !== "active_year") {
    throw new Error("إعدادات الحساب لم تُعزل أو لم تُصدّر");
  }
  if (backup.media.length !== 1 || backup.media[0].dataBase64 !== "AAEC/w o=".replaceAll(" ", "")) {
    throw new Error("محتوى ملف الوسائط لم يُضمَّن في JSON");
  }
  const serialized = JSON.stringify(backup);
  if (
    serialized.includes("password_hash") ||
    serialized.includes('"app_users"') ||
    serialized.includes('"data_grants"')
  ) {
    throw new Error("تسرّبت بيانات الحسابات أو كلمات المرور إلى النسخة");
  }
});

await ok("المعاينة تحسب الدمج دون كتابة أي بيانات", async () => {
  const extended = structuredClone(backup);
  extended.tables.students.push({
    ...sourceStudent,
    id: 12,
    name: "طالبة جديدة",
    custom_fields: "{}",
  });
  const before = await db.query("SELECT COUNT(*) AS c FROM students WHERE user_id = ?", [ownerId]);
  const preview = await app.previewAccountBackup(extended);
  const after = await db.query("SELECT COUNT(*) AS c FROM students WHERE user_id = ?", [ownerId]);
  if (Number(before.values?.[0]?.c) !== Number(after.values?.[0]?.c)) {
    throw new Error("تغيّرت قاعدة البيانات أثناء المعاينة");
  }
  const studentPreview = preview.tables.find((table) => table.table === "students");
  if (studentPreview?.added !== 1 || studentPreview.matched !== 1) {
    throw new Error(`أعداد الطلاب في المعاينة غير متوقعة: ${JSON.stringify(studentPreview)}`);
  }
});

await ok("الاستعادة تملأ فراغ الطالب المطابق وتعيد ربط السجلات والوسائط", async () => {
  target = await app.signUp({
    email: TARGET_EMAIL,
    password: PASSWORD,
    displayName: "مالك الجهاز الجديد",
  });
  await app.signIn(TARGET_EMAIL, PASSWORD);
  targetId = target.id;

  await insert("students", {
    ...sourceStudent,
    id: 22,
    name: "احمد محمد",
    teacher: "معلم محلي",
    user_id: targetId,
    gender: null,
    hijri_join_date: null,
    initial_hifz: null,
    first_competition_year: null,
    status: "موجود محلياً",
    school_grade: null,
    guardian_phone: null,
    student_phone: null,
    custom_fields: JSON.stringify({ old: "قيمة محلية", empty: "" }),
    notes: "",
  });
  await insert("donors", {
    id: "donor-target",
    user_id: targetId,
    year: "1447",
    name: "عبد الله",
    donor_type: "فرد",
    phone: "777",
    pledged_amount: 0,
    paid_amount: 0,
    in_kind: null,
    notes: null,
    created_at: STAMP,
    updated_at: STAMP,
  });

  const result = await app.restoreAccountBackup(backup);
  const student = (await db.query("SELECT * FROM students WHERE user_id = ?", [targetId]))
    .values?.[0];
  if (
    Number(student?.id) !== 22 ||
    student?.teacher !== "معلم محلي" ||
    student?.status !== "موجود محلياً"
  ) {
    throw new Error("الاستعادة استبدلت بيانات الطالب الموجودة");
  }
  if (student?.gender !== "male" || student?.notes !== "ملاحظة من النسخة") {
    throw new Error("لم تُملأ الحقول الفارغة في الطالب المطابق");
  }
  const customFields = JSON.parse(String(student?.custom_fields ?? "{}"));
  if (customFields.old !== "قيمة محلية" || customFields.empty !== "معلومة مستعادة") {
    throw new Error("دمج الأعمدة المخصصة لم يحافظ على الموجود أو يملأ الفراغ");
  }
  const history = await db.query(
    "SELECT * FROM hifz_history WHERE student_id = 22 AND year_key = 'h1447'",
  );
  const year = await db.query("SELECT * FROM year_data WHERE student_id = 22 AND year = '1447'");
  if (history.values?.length !== 1 || year.values?.length !== 1) {
    throw new Error("لم تُعَد ربط سجلات الحفظ والأعوام بمعرّف الطالب المحلي");
  }
  const localDonor = await db.query("SELECT * FROM donors WHERE id = 'donor-target'");
  const donorRows = await db.query(
    "SELECT id FROM donors WHERE user_id = ? AND year = '1447' AND name = 'مؤسسة النور'",
    [targetId],
  );
  if (
    localDonor.values?.length !== 1 ||
    localDonor.values[0].notes !== "داعم سنوي" ||
    donorRows.values?.length !== 1
  ) {
    throw new Error("لم تُدمج الجهة الداعمة بمفتاحها الطبيعي أو أُنشئ تكرار");
  }
  const portal = (await db.query("SELECT * FROM teacher_portals WHERE user_id = ?", [targetId]))
    .values?.[0];
  const submission = (
    await db.query("SELECT * FROM monthly_submissions WHERE user_id = ?", [targetId])
  ).values?.[0];
  if (
    !portal ||
    !submission ||
    submission.portal_id !== portal.id ||
    submission.student_id !== 22
  ) {
    throw new Error("لم تُعَد ربط بوابة المعلم/الترسيل بالطالب والمالك المحليين");
  }
  const community = await db.query("SELECT id FROM community_records WHERE user_id = ?", [
    targetId,
  ]);
  const questions = await db.query("SELECT id FROM exam_questions WHERE user_id = ?", [targetId]);
  if (community.values?.length !== 1 || questions.values?.length !== 1) {
    throw new Error("لم تُستعد جداول سجل المجتمع وبنك الأسئلة");
  }
  const setting = await db.query("SELECT value FROM settings WHERE key = ?", [
    `${targetId}:active_year`,
  ]);
  if (JSON.parse(String(setting.values?.[0]?.value)) !== "1447")
    throw new Error("إعداد الحساب لم يُستعد");
  const media = (await db.query("SELECT * FROM media WHERE user_id = ?", [targetId])).values?.[0];
  if (!media) throw new Error("لم يُنشأ سجل الوسيط للحساب الهدف");
  const restoredBlob = app.__getMediaFilesForTests().get(media.file_path);
  if (
    !restoredBlob ||
    new Uint8Array(await restoredBlob.arrayBuffer()).join(",") !== "0,1,2,255,10"
  ) {
    throw new Error("لم يُستعد محتوى الوسيط أو تلف أثناء النقل");
  }
  if (result.tables.length !== 16 || result.totalAdded === 0)
    throw new Error("ملخص الاستعادة غير مكتمل");
  const users = await app.listAuthUsers();
  if (
    users.length !== 2 ||
    !users.some((user) => user.id === ownerId) ||
    !users.some((user) => user.id === targetId)
  ) {
    throw new Error("تغيّرت حسابات الدخول أثناء استعادة بيانات الحساب");
  }
});

await ok("إعادة الاستعادة تدمج بالمفاتيح الطبيعية بلا تكرار", async () => {
  const before = await db.query("SELECT COUNT(*) AS c FROM students WHERE user_id = ?", [targetId]);
  const donorBefore = await db.query("SELECT COUNT(*) AS c FROM donors WHERE user_id = ?", [
    targetId,
  ]);
  const mediaBefore = await db.query("SELECT COUNT(*) AS c FROM media WHERE user_id = ?", [
    targetId,
  ]);
  const result = await app.restoreAccountBackup(backup);
  const after = await db.query("SELECT COUNT(*) AS c FROM students WHERE user_id = ?", [targetId]);
  const donorAfter = await db.query("SELECT COUNT(*) AS c FROM donors WHERE user_id = ?", [
    targetId,
  ]);
  const mediaAfter = await db.query("SELECT COUNT(*) AS c FROM media WHERE user_id = ?", [
    targetId,
  ]);
  if (result.totalAdded !== 0 || Number(before.values?.[0]?.c) !== Number(after.values?.[0]?.c)) {
    throw new Error("إعادة الاستعادة أضافت سجلات مكررة");
  }
  if (
    Number(donorBefore.values?.[0]?.c) !== Number(donorAfter.values?.[0]?.c) ||
    Number(mediaBefore.values?.[0]?.c) !== Number(mediaAfter.values?.[0]?.c)
  ) {
    throw new Error("تكرر سجل داعم أو ملف وسيط بعد الاستعادة الثانية");
  }
});

await ok("وضع الاطلاع يرفض الاستعادة والملف لا يقبل جداول حسابات الدخول", async () => {
  const before = await db.query("SELECT COUNT(*) AS c FROM students WHERE user_id = ?", [targetId]);
  app.setViewAs({ id: ownerId, name: "بيانات للقراءة فقط", email: null });
  let readonlyRejected = false;
  try {
    await app.restoreAccountBackup(backup);
  } catch (error) {
    readonlyRejected = String(error?.message ?? error).includes("وضع الاطلاع");
  } finally {
    app.setViewAs(null);
  }
  if (!readonlyRejected) throw new Error("لم تُرفض الكتابة أثناء وضع الاطلاع");
  const after = await db.query("SELECT COUNT(*) AS c FROM students WHERE user_id = ?", [targetId]);
  if (Number(before.values?.[0]?.c) !== Number(after.values?.[0]?.c)) {
    throw new Error("تغيّرت البيانات رغم وضع الاطلاع");
  }
  let accountsRejected = false;
  try {
    app.parseAccountBackup({ ...backup, tables: { ...backup.tables, app_users: [] } });
  } catch {
    accountsRejected = true;
  }
  if (!accountsRejected) throw new Error("قُبل ملف يتضمن جدول حسابات الدخول");
});

finish("اختبارات النسخ الاحتياطي والاستعادة");
