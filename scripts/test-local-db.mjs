/**
 * اختبار قاعدة البيانات المحلية — يشغّل طبقة localDB الحقيقية فوق sql.js
 * بنفس المخطط الحقيقي المستخرج من sqliteClient.ts.
 *
 *   node scripts/test-local-db.mjs
 */

import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildTestBundle, installBrowserShim, createTestRunner } from "./test-harness.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

installBrowserShim();

const outfile = await buildTestBundle({
  stdinSource: `
export * from ${JSON.stringify(path.join(ROOT, "src/utils/localDB.ts"))};
export { getDB } from "./sqliteClient";
`,
  outfile: path.join(ROOT, ".output/tests/test-local-db.mjs"),
});

const db = await import(outfile);

const { ok, finish } = createTestRunner();
console.log("اختبار قاعدة البيانات المحلية (sql.js + المخطط الحقيقي)\n");

const USER_A = "user-a";
const USER_B = "user-b";

await ok("المخطط: كل الجداول الاثنين والعشرين موجودة", async () => {
  const conn = await db.getDB();
  const res = await conn.query(
    `SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'`,
  );
  const names = (res.values ?? []).map((r) => r.name).sort();
  const expected = [
    "app_users",
    "awards",
    "certificates",
    "ceremony_expenses",
    "community_records",
    "data_grants",
    "exam_questions",
    "donors",
    "external_competitions",
    "hifz_history",
    "internal_competitions",
    "media",
    "meta",
    "monthly_submissions",
    "monthly_tracking",
    "pending_changes",
    "settings",
    "students",
    "teacher_bonuses",
    "teacher_portals",
    "teachers",
    "year_data",
  ].sort();
  const missing = expected.filter((t) => !names.includes(t));
  if (missing.length > 0) throw new Error(`جداول مفقودة: ${missing.join(", ")}`);
  if (names.length !== expected.length) {
    throw new Error(`عدد الجداول ${names.length} بدل ${expected.length}: ${names.join(",")}`);
  }
});

await ok("الطلاب: putItem/getItem/getAllItems/deleteItem", async () => {
  await db.putCachedStudent({
    id: 1,
    name: "طالبة تجريبية",
    teacher: "معلمة أولى",
    user_id: USER_A,
    gender: "female",
    hijri_join_date: null,
    initial_hifz: null,
    first_competition_year: null,
    status: "طبيعي",
    school_grade: null,
    guardian_phone: null,
    student_phone: null,
    custom_fields: { عمود: "قيمة" },
    notes: null,
  });
  await db.putCachedStudent({
    id: 2,
    name: "طالبة ثانية",
    teacher: "",
    user_id: USER_A,
    gender: null,
    hijri_join_date: null,
    initial_hifz: null,
    first_competition_year: null,
    status: "طبيعي",
    school_grade: null,
    guardian_phone: null,
    student_phone: null,
    custom_fields: {},
    notes: null,
  });

  const all = await db.getCachedStudents();
  if (all.length !== 2) throw new Error(`عدد الطلاب ${all.length} بدل 2`);
  if (all[0].name !== "طالبة تجريبية") throw new Error("الاسم غير مطابق");
  if (typeof all[0].custom_fields !== "object" || all[0].custom_fields.عمود !== "قيمة") {
    throw new Error("الحقول المخصصة لم تُخزَّن/تُسترجع ككائن");
  }

  await db.deleteCachedStudent(2);
  const after = await db.getCachedStudents();
  if (after.length !== 1) throw new Error("الحذف لم يعمل");

  // تحديث صف قائم يعمل upsert لا تكراراً
  await db.putCachedStudent({ ...all[0], name: "اسم محدث" });
  const renamed = await db.getCachedStudents();
  if (renamed.length !== 1 || renamed[0].name !== "اسم محدث") {
    throw new Error("التحديث (upsert) لم يعمل");
  }
});

await ok("بيانات الأعوام والحفظ: كتابة وقراءة لعام واحد", async () => {
  await db.putCachedYearData({
    student_id: 1,
    year: "1447",
    base_hifz: "5",
    total_hifz: "7",
    parts: "2",
    annual: "18",
    recitation: "40",
    memorization: "35",
    total: "93",
    grade: "ممتاز",
    prize: "15000",
    status_prize: "",
    rank: "1",
    teacher: "معلمة أولى",
  });
  await db.putCachedHifzRow({ student_id: 1, year_key: "h1447", value: "2" });

  const forYear = await db.getCachedYearDataForYear("1447");
  if (forYear.length !== 1 || forYear[0].total !== "93") throw new Error("قراءة عام خاطئة");

  const history = await db.getCachedHifzHistoryForStudents([1]);
  if (history.length !== 1 || history[0].value !== "2") throw new Error("قراءة الحفظ خاطئة");

  const forStudent = await db.getCachedYearDataForStudent(1);
  if (forStudent.length !== 1) throw new Error("قراءة طالب خاطئة");
});

await ok("الإعدادات: مفاتيح مقيدة بالمستخدم", async () => {
  await db.setCachedSetting(`${USER_A}:active_year`, "1447");
  await db.setCachedSetting(`${USER_B}:active_year`, "1448");

  const a = await db.getCachedSetting(`${USER_A}:active_year`);
  const b = await db.getCachedSetting(`${USER_B}:active_year`);
  if (a !== "1447" || b !== "1448") throw new Error("الإعدادات غير معزولة");
});

await ok("المتابعة الشهرية والبوابة والترسيلات: CRUD كامل", async () => {
  await db.putMonthlyTracking({
    user_id: USER_A,
    student_id: 1,
    year: "1447",
    month: 9,
    memorization_from_surah: 1,
    memorization_from_ayah: 1,
    memorization_to_surah: 2,
    memorization_to_ayah: 20,
    memorization_hifz_score: 22,
    memorization_recitation_score: 13,
    review_from_surah: 1,
    review_from_ayah: 1,
    review_to_surah: 1,
    review_to_ayah: 100,
    review_hifz_score: 20,
    review_recitation_score: 12,
    attendance_score: 9,
    behavior_score: 8,
  });
  const month = await db.getMonthlyTrackingForMonth(USER_A, "1447", 9);
  if (month.length !== 1 || month[0].memorization_hifz_score !== 22) {
    throw new Error("قراءة المتابعة الشهرية خاطئة");
  }
  const forStudent = await db.getMonthlyTrackingForStudent(USER_A, "1447", 1);
  if (forStudent.length !== 1) throw new Error("قراءة متابعة الطالب خاطئة");
  const latest = await db.getLatestMonthlyTrackingPeriod(USER_A);
  if (latest?.year !== "1447" || latest?.month !== 9) throw new Error("أحدث فترة خاطئة");

  await db.putTeacherPortal({
    id: "portal-1",
    user_id: USER_A,
    teacher_name: "معلمة أولى",
    code: "abcd2345",
    year: "1447",
    month: 9,
    active: true,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
  });
  const byCode = await db.getTeacherPortalByCode("abcd2345");
  if (!byCode || byCode.teacher_name !== "معلمة أولى") throw new Error("قراءة الرابط بالكود خاطئة");

  await db.putSubmission({
    id: "sub-1",
    user_id: USER_A,
    portal_id: "portal-1",
    code: "abcd2345",
    student_id: 1,
    student_name: "طالبة تجريبية",
    year: "1447",
    month: 9,
    memorization_from_surah: 1,
    memorization_from_ayah: 1,
    memorization_to_surah: 2,
    memorization_to_ayah: 20,
    memorization_hifz_score: 22,
    memorization_recitation_score: 13,
    review_from_surah: null,
    review_from_ayah: null,
    review_to_surah: null,
    review_to_ayah: null,
    review_hifz_score: 0,
    review_recitation_score: 0,
    attendance_score: 9,
    behavior_score: 8,
    notes: null,
    status: "pending",
    source: "portal",
    teacher_name: "معلمة أولى",
    review_note: null,
    reviewed_at: null,
    created_at: "2026-01-02T00:00:00.000Z",
    updated_at: "2026-01-02T00:00:00.000Z",
  });
  const subs = await db.getSubmissions(USER_A, { status: "pending" });
  if (subs.length !== 1) throw new Error("قراءة الترسيلات بالمرشح خاطئة");
  const byPortal = await db.getSubmissionByPortalAndStudent("portal-1", 1);
  if (!byPortal || byPortal.id !== "sub-1") throw new Error("قراءة ترسيل البوابة خاطئة");

  await db.deleteMonthlyTrackingForStudentYear(USER_A, "1447", 1);
  const afterDelete = await db.getMonthlyTrackingForStudent(USER_A, "1447", 1);
  if (afterDelete.length !== 0) throw new Error("حذف متابعة الطالب/العام لم يعمل");
});

await ok("سجل المجتمع وبنك الأسئلة: CRUD وعزل بالمستخدم والقسم/العام", async () => {
  const stamp = "2026-01-01T00:00:00.000Z";
  await db.putCachedCommunityRecord({
    id: "cr-a-1",
    user_id: USER_A,
    department: "care",
    program_id: "orphan_sponsorship",
    beneficiary_name: "مستفيد أ",
    beneficiary_type: "فرد",
    phone: null,
    guardian_name: null,
    address: null,
    service_date: "1447-01-01",
    status: "registered",
    group_name: null,
    sponsor_name: null,
    amount: 100,
    currency: "ريال",
    quantity: null,
    notes: null,
    created_at: stamp,
    updated_at: stamp,
  });
  await db.putCachedCommunityRecord({
    id: "cr-a-2",
    user_id: USER_A,
    department: "training",
    program_id: "quran_teacher_training",
    beneficiary_name: "متدربة أ",
    beneficiary_type: "فرد",
    phone: null,
    guardian_name: null,
    address: null,
    service_date: "1447-02-01",
    status: "active",
    group_name: null,
    sponsor_name: null,
    amount: null,
    currency: null,
    quantity: null,
    notes: null,
    created_at: stamp,
    updated_at: stamp,
  });
  await db.putCachedCommunityRecord({
    id: "cr-b-1",
    user_id: USER_B,
    department: "care",
    program_id: "orphan_sponsorship",
    beneficiary_name: "مستفيد ب",
    beneficiary_type: "فرد",
    phone: null,
    guardian_name: null,
    address: null,
    service_date: "1447-01-15",
    status: "registered",
    group_name: null,
    sponsor_name: null,
    amount: null,
    currency: null,
    quantity: null,
    notes: null,
    created_at: stamp,
    updated_at: stamp,
  });

  const careA = await db.getCachedCommunityRecordsForDepartment(USER_A, "care");
  if (careA.length !== 1 || careA[0].id !== "cr-a-1") {
    throw new Error("استعلام قسم الرعاية لم يعزل بالمستخدم والقسم");
  }
  const trainingA = await db.getCachedCommunityRecordsForDepartment(USER_A, "training");
  if (trainingA.length !== 1 || trainingA[0].id !== "cr-a-2") {
    throw new Error("استعلام قسم التدريب أعاد صفوفاً خاطئة");
  }

  await db.putCachedExamQuestion({
    id: "eq-a-1",
    user_id: USER_A,
    year: "1447",
    category: "ثلاثة أجزاء",
    subject: "حفظ",
    question_type: "memorization",
    question: "اقرأ غيبًا من بداية سورة النبأ",
    choices: null,
    correct_answer: null,
    difficulty: "متوسط",
    notes: null,
    created_at: stamp,
    updated_at: stamp,
  });
  await db.putCachedExamQuestion({
    id: "eq-b-1",
    user_id: USER_B,
    year: "1447",
    category: "جزء واحد",
    subject: "حفظ",
    question_type: "memorization",
    question: "اقرأ غيبًا من بداية سورة الضحى",
    choices: null,
    correct_answer: null,
    difficulty: "سهل",
    notes: null,
    created_at: stamp,
    updated_at: stamp,
  });

  const examA = await db.getCachedExamQuestionsForYear(USER_A, "1447");
  if (examA.length !== 1 || examA[0].id !== "eq-a-1") {
    throw new Error("استعلام بنك الأسئلة لم يعزل بالمستخدم والعام");
  }

  await db.deleteCachedExamQuestion("eq-a-1");
  if ((await db.getCachedExamQuestionsForYear(USER_A, "1447")).length !== 0) {
    throw new Error("حذف السؤال لم ينجح");
  }
  // نعيده حتى يُختبر حذفه ضمن deleteAllRowsForUser في الاختبار التالي.
  await db.putCachedExamQuestion({
    id: "eq-a-1",
    user_id: USER_A,
    year: "1447",
    category: "ثلاثة أجزاء",
    subject: "حفظ",
    question_type: "memorization",
    question: "اقرأ غيبًا من بداية سورة النبأ",
    choices: null,
    correct_answer: null,
    difficulty: "متوسط",
    notes: null,
    created_at: stamp,
    updated_at: stamp,
  });
});

await ok("deleteAllRowsForUser: حذف مستخدم لا يمسّ بيانات غيره ولا الحسابات", async () => {
  // بيانات لمستخدم ثانٍ + حسابات مستخدمين في جدول app_users
  const conn = await db.getDB();
  await conn.run(
    `INSERT INTO app_users (id, email, password_hash, display_name, is_admin, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    ["u-admin", "admin@markz.local", "x", "المسؤولة", 1, "2026-01-01T00:00:00.000Z"],
  );
  await db.putCachedStudent({
    id: 50,
    name: "طالبة المستخدم الثاني",
    teacher: "",
    user_id: USER_B,
    gender: null,
    hijri_join_date: null,
    initial_hifz: null,
    first_competition_year: null,
    status: "طبيعي",
    school_grade: null,
    guardian_phone: null,
    student_phone: null,
    custom_fields: {},
    notes: null,
  });
  await db.setCachedSetting(`${USER_B}:active_year`, "1448");

  await db.deleteAllRowsForUser(USER_A);

  const studentsLeft = await db.getCachedStudents();
  if (studentsLeft.length !== 1 || studentsLeft[0].user_id !== USER_B) {
    throw new Error("حذف بيانات المستخدم الأول مسّ بيانات الثاني");
  }
  const bSetting = await db.getCachedSetting(`${USER_B}:active_year`);
  if (bSetting !== "1448") throw new Error("إعدادات المستخدم الثاني حُذفت خطأً");
  const users = await conn.query(`SELECT id FROM app_users`);
  if ((users.values ?? []).length !== 1) throw new Error("جدول الحسابات تأثر بالحذف");
  const subsLeft = await db.getSubmissions(USER_A);
  if (subsLeft.length !== 0) throw new Error("ترسيلات المستخدم الأول لم تُحذف");

  // سجل المجتمع وبنك الأسئلة: صفوف المستخدم الأول تُحذف وصفوف الثاني تبقى.
  const careLeftA = await db.getCachedCommunityRecordsForDepartment(USER_A, "care");
  const trainingLeftA = await db.getCachedCommunityRecordsForDepartment(USER_A, "training");
  if (careLeftA.length !== 0 || trainingLeftA.length !== 0) {
    throw new Error("سجل المجتمع للمستخدم الأول لم يُحذف");
  }
  const careLeftB = await db.getCachedCommunityRecordsForDepartment(USER_B, "care");
  if (careLeftB.length !== 1) throw new Error("سجل المجتمع للمستخدم الثاني حُذف خطأً");
  const examLeftA = await db.getCachedExamQuestionsForYear(USER_A, "1447");
  if (examLeftA.length !== 0) throw new Error("بنك أسئلة المستخدم الأول لم يُحذف");
  const examLeftB = await db.getCachedExamQuestionsForYear(USER_B, "1447");
  if (examLeftB.length !== 1) throw new Error("بنك أسئلة المستخدم الثاني حُذف خطأً");
});

finish("اختبار قاعدة البيانات المحلية");
