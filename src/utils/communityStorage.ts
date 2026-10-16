/**
 * سجل المجتمع — تخزين **محلي بالكامل** (النسخة المستقلة بلا إنترنت).
 *
 * في النسخة السحابية كانت القراءة محلية مع تحديث من Supabase والرفع في
 * الخلفية. هنا لا توجد أي سحابة: كل القراءة والكتابة على قاعدة SQLite
 * المحلية مباشرة، مع نفس واجهة الدوال التي تستعملها المكونات.
 *
 * وضع الاطلاع (view-as) يعمل لأن بيانات المالك موجودة على نفس الجهاز:
 * القراءة من صفوفه المحلية، وكل كتابة مرفوضة (قراءة فقط).
 */

import type { CommunityDepartment } from "@/lib/center-programs";
import {
  communityRecordSchema,
  newCommunityRecordId,
  sortCommunityRecords,
  type CommunityRecord,
  type CommunityRecordInput,
  type CommunityRecordRow,
} from "@/lib/community-records";
import {
  deleteCachedCommunityRecord,
  getCachedCommunityRecord,
  getCachedCommunityRecordsForDepartment,
  putCachedCommunityRecord,
} from "./localDB";
import { getSessionUserId } from "./localAuth";
import { getViewAsId, isViewingOtherUser } from "./viewAs";

/** معرّف الجلسة المحلية، أو خطأ عربي عند عدم الدخول. */
const sessionUserId = async (): Promise<string> => {
  const id = await getSessionUserId();
  if (!id) throw new Error("يلزم تسجيل الدخول");
  return id;
};

/**
 * مالك البيانات المعروضة: صاحب الحساب في وضع الاطلاع، وإلا معرّف الجلسة.
 */
const resolveOwnerId = async (): Promise<string> => getViewAsId() ?? (await sessionUserId());

/**
 * يتحقق أن الكتابة مسموحة ويرجع مالكها.
 *
 * @throws «وضع الاطلاع للقراءة فقط» أو «تغيّر الحساب؛ أعد فتح الصفحة».
 */
const assertWritableOwner = async (expectedUserId?: string): Promise<string> => {
  if (isViewingOtherUser()) throw new Error("وضع الاطلاع للقراءة فقط");
  const id = await sessionUserId();
  if (expectedUserId && id !== expectedUserId) throw new Error("تغيّر الحساب؛ أعد فتح الصفحة");
  return id;
};

/** كل سجلات قسم واحد — قراءة محلية خالصة (تشمل وضع الاطلاع). */
export async function loadCommunityRecords(
  department: CommunityDepartment,
  _signal?: AbortSignal,
): Promise<CommunityRecord[]> {
  const ownerId = await resolveOwnerId();
  const rows = await getCachedCommunityRecordsForDepartment(ownerId, department);
  return sortCommunityRecords(rows);
}

/** حفظ سجل (إضافة أو تعديل) — محلي بالكامل. */
export async function saveCommunityRecord(
  input: CommunityRecordInput,
  id: string | undefined,
  expectedUserId: string,
): Promise<CommunityRecord> {
  const ownerId = await assertWritableOwner(expectedUserId);
  const values = communityRecordSchema.parse(input);
  const stamp = new Date().toISOString();
  const recordId = id ?? newCommunityRecordId();
  const previous = id ? await getCachedCommunityRecord(id) : undefined;

  const record: CommunityRecordRow = {
    ...values,
    id: recordId,
    user_id: ownerId,
    created_at: previous?.created_at ?? stamp,
    updated_at: stamp,
    local_updated_at: stamp,
  };
  await putCachedCommunityRecord(record);
  return record;
}

/** حذف سجل — محلي بالكامل. */
export async function deleteCommunityRecord(
  id: string,
  _department: CommunityDepartment,
  expectedUserId: string,
): Promise<{ id: string }> {
  await assertWritableOwner(expectedUserId);
  await deleteCachedCommunityRecord(id);
  return { id };
}

export { communityErrorMessage } from "@/lib/community-records";
