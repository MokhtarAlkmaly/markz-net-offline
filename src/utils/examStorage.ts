/**
 * بنك الأسئلة — تخزين **محلي بالكامل** (النسخة المستقلة بلا إنترنت).
 *
 * نفس واجهة الدوال التي تستعملها تبويبات صفحة «الأسئلة والاختبارات»
 * (`ExtraBankTab` و`ExamPapersTab`)، لكن بلا أي سحابة: القراءة والكتابة
 * على قاعدة SQLite المحلية مباشرة.
 *
 * وضع الاطلاع (view-as) يعمل لأن بيانات المالك موجودة على نفس الجهاز:
 * القراءة من صفوفه المحلية، وكل كتابة مرفوضة (قراءة فقط).
 */

import {
  createExamQuestion,
  examQuestionSchema,
  fromExamQuestionRow,
  sortExamQuestions,
  toExamQuestionRow,
  type ExamQuestion,
  type ExamQuestionInput,
} from "@/lib/exam-questions";
import {
  deleteCachedExamQuestion,
  getCachedExamQuestion,
  getCachedExamQuestionsForYear,
  putCachedExamQuestion,
} from "./localDB";
import { getSessionUserId } from "./localAuth";
import { getViewAsId, isViewingOtherUser } from "./viewAs";

/** معرّف الجلسة المحلية، أو خطأ عربي عند عدم الدخول. */
const sessionUserId = async (): Promise<string> => {
  const id = await getSessionUserId();
  if (!id) throw new Error("يلزم تسجيل الدخول");
  return id;
};

/** مالك البيانات المعروضة: صاحب الحساب في وضع الاطلاع، وإلا معرّف الجلسة. */
const resolveOwnerId = async (): Promise<string> => getViewAsId() ?? (await sessionUserId());

/** يتحقق أن الكتابة مسموحة ويرجع مالكها. */
const assertWritableOwner = async (): Promise<string> => {
  if (isViewingOtherUser()) throw new Error("وضع الاطلاع للقراءة فقط");
  return sessionUserId();
};

/** كل أسئلة عام واحد — قراءة محلية خالصة (تشمل وضع الاطلاع). */
export const loadExamQuestions = async (
  year: string,
  _signal?: AbortSignal,
): Promise<ExamQuestion[]> => {
  const ownerId = await resolveOwnerId();
  const rows = await getCachedExamQuestionsForYear(ownerId, year);
  return sortExamQuestions(rows.map(fromExamQuestionRow));
};

/** حفظ سؤال (إضافة أو تعديل) — محلي بالكامل. */
export const saveExamQuestion = async (
  input: ExamQuestionInput,
  id?: string,
): Promise<ExamQuestion> => {
  const ownerId = await assertWritableOwner();
  const values = examQuestionSchema.parse(input);
  const questionId = id ?? undefined;
  const previous = questionId ? await getCachedExamQuestion(questionId) : undefined;
  const created = createExamQuestion(values, ownerId, questionId);
  const record: ExamQuestion = {
    ...created,
    created_at: previous?.created_at ?? created.created_at,
  };
  await putCachedExamQuestion(toExamQuestionRow(record));
  return record;
};

/** حفظ دفعة من الأسئلة (نماذج الاختبار المولَّدة) دفعة محلية واحدة. */
export const saveExamQuestions = async (
  inputs: ExamQuestionInput[],
): Promise<{ saved: ExamQuestion[]; skipped: number }> => {
  const ownerId = await assertWritableOwner();
  const existing = await getCachedExamQuestionsForYear(ownerId, inputs[0]?.year ?? "");
  const seen = new Set(existing.map((row) => row.question.trim().toLocaleLowerCase("ar")));
  const saved: ExamQuestion[] = [];
  let skipped = 0;
  for (const input of inputs) {
    const key = input.question.trim().toLocaleLowerCase("ar");
    if (seen.has(key)) {
      skipped++;
      continue;
    }
    seen.add(key);
    const record = createExamQuestion(input, ownerId);
    await putCachedExamQuestion(toExamQuestionRow(record));
    saved.push(record);
  }
  return { saved, skipped };
};

/** حذف سؤال — محلي بالكامل. */
export const deleteExamQuestion = async (id: string): Promise<{ id: string }> => {
  await assertWritableOwner();
  await deleteCachedExamQuestion(id);
  return { id };
};

export { examQuestionErrorMessage } from "@/lib/exam-questions";
