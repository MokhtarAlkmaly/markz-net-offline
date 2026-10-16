/**
 * نسخ احتياطي محلي لحساب واحد ودمج الاستعادة بلا اتصال أو حسابات دخول.
 * الملف يحتوي جداول البيانات الستة عشر، إعدادات الحساب، وملفات الوسائط.
 */

import { getDB, persistNow } from "./sqliteClient";
import { getSessionUserId } from "./localAuth";
import { getViewAsId, isViewingOtherUser } from "./viewAs";
import { normalizeStudentName } from "./studentNames";
import { deleteMediaFiles, getMediaFile, makeMediaKey, putMediaFile } from "./mediaStore";

type DbValue = string | number | null;
type DbRow = Record<string, DbValue>;
type TableName =
  | "students"
  | "hifz_history"
  | "year_data"
  | "teachers"
  | "teacher_bonuses"
  | "donors"
  | "awards"
  | "ceremony_expenses"
  | "certificates"
  | "internal_competitions"
  | "external_competitions"
  | "monthly_tracking"
  | "teacher_portals"
  | "monthly_submissions"
  | "community_records"
  | "exam_questions";

interface TableConfig {
  name: TableName;
  columns: readonly string[];
  primaryKey: readonly string[];
  scope: "user" | "students";
}

const TABLES: readonly TableConfig[] = [
  {
    name: "students",
    columns: [
      "id",
      "name",
      "teacher",
      "user_id",
      "gender",
      "hijri_join_date",
      "initial_hifz",
      "first_competition_year",
      "status",
      "school_grade",
      "guardian_phone",
      "student_phone",
      "custom_fields",
      "notes",
    ],
    primaryKey: ["id"],
    scope: "user",
  },
  {
    name: "hifz_history",
    columns: ["student_id", "year_key", "value"],
    primaryKey: ["student_id", "year_key"],
    scope: "students",
  },
  {
    name: "year_data",
    columns: [
      "student_id",
      "year",
      "base_hifz",
      "total_hifz",
      "parts",
      "annual",
      "recitation",
      "memorization",
      "total",
      "grade",
      "prize",
      "status_prize",
      "rank",
      "teacher",
    ],
    primaryKey: ["student_id", "year"],
    scope: "students",
  },
  {
    name: "teachers",
    columns: ["id", "user_id", "year", "name", "created_at", "updated_at"],
    primaryKey: ["id"],
    scope: "user",
  },
  {
    name: "teacher_bonuses",
    columns: [
      "id",
      "user_id",
      "teacher_name",
      "year",
      "month",
      "amount",
      "created_at",
      "updated_at",
    ],
    primaryKey: ["id"],
    scope: "user",
  },
  {
    name: "donors",
    columns: [
      "id",
      "user_id",
      "year",
      "name",
      "donor_type",
      "phone",
      "pledged_amount",
      "paid_amount",
      "in_kind",
      "notes",
      "created_at",
      "updated_at",
    ],
    primaryKey: ["id"],
    scope: "user",
  },
  {
    name: "awards",
    columns: [
      "id",
      "user_id",
      "year",
      "recipient_type",
      "recipient_name",
      "award_type",
      "award_kind",
      "amount",
      "item",
      "student_name",
      "notes",
      "awarded_at",
      "funded_by",
      "created_at",
      "updated_at",
    ],
    primaryKey: ["id"],
    scope: "user",
  },
  {
    name: "ceremony_expenses",
    columns: [
      "id",
      "user_id",
      "year",
      "category",
      "description",
      "amount",
      "spent_at",
      "funded_by",
      "notes",
      "created_at",
      "updated_at",
    ],
    primaryKey: ["id"],
    scope: "user",
  },
  {
    name: "certificates",
    columns: [
      "id",
      "user_id",
      "year",
      "recipient_type",
      "recipient_name",
      "cert_type",
      "title",
      "notes",
      "issued_at",
      "created_at",
      "updated_at",
    ],
    primaryKey: ["id"],
    scope: "user",
  },
  {
    name: "internal_competitions",
    columns: [
      "id",
      "user_id",
      "student_id",
      "student_name",
      "year",
      "competition_name",
      "category",
      "score",
      "rank",
      "prize",
      "notes",
      "date",
      "created_at",
      "updated_at",
    ],
    primaryKey: ["id"],
    scope: "user",
  },
  {
    name: "external_competitions",
    columns: [
      "id",
      "user_id",
      "student_id",
      "student_name",
      "year",
      "competition_name",
      "organizer",
      "category",
      "score",
      "rank",
      "prize",
      "notes",
      "date",
      "created_at",
      "updated_at",
    ],
    primaryKey: ["id"],
    scope: "user",
  },
  {
    name: "monthly_tracking",
    columns: [
      "user_id",
      "student_id",
      "year",
      "month",
      "memorization_from_surah",
      "memorization_from_ayah",
      "memorization_to_surah",
      "memorization_to_ayah",
      "memorization_hifz_score",
      "memorization_recitation_score",
      "review_from_surah",
      "review_from_ayah",
      "review_to_surah",
      "review_to_ayah",
      "review_hifz_score",
      "review_recitation_score",
      "attendance_score",
      "behavior_score",
    ],
    primaryKey: ["student_id", "year", "month"],
    scope: "user",
  },
  {
    name: "teacher_portals",
    columns: [
      "id",
      "user_id",
      "teacher_name",
      "code",
      "year",
      "month",
      "active",
      "created_at",
      "updated_at",
    ],
    primaryKey: ["id"],
    scope: "user",
  },
  {
    name: "monthly_submissions",
    columns: [
      "id",
      "user_id",
      "portal_id",
      "code",
      "student_id",
      "student_name",
      "year",
      "month",
      "memorization_from_surah",
      "memorization_from_ayah",
      "memorization_to_surah",
      "memorization_to_ayah",
      "memorization_hifz_score",
      "memorization_recitation_score",
      "review_from_surah",
      "review_from_ayah",
      "review_to_surah",
      "review_to_ayah",
      "review_hifz_score",
      "review_recitation_score",
      "attendance_score",
      "behavior_score",
      "notes",
      "status",
      "source",
      "teacher_name",
      "review_note",
      "reviewed_at",
      "created_at",
      "updated_at",
    ],
    primaryKey: ["id"],
    scope: "user",
  },
  {
    name: "community_records",
    columns: [
      "id",
      "user_id",
      "department",
      "program_id",
      "beneficiary_name",
      "beneficiary_type",
      "phone",
      "guardian_name",
      "address",
      "service_date",
      "status",
      "group_name",
      "sponsor_name",
      "amount",
      "currency",
      "quantity",
      "notes",
      "created_at",
      "updated_at",
    ],
    primaryKey: ["id"],
    scope: "user",
  },
  {
    name: "exam_questions",
    columns: [
      "id",
      "user_id",
      "year",
      "category",
      "subject",
      "question_type",
      "question",
      "choices",
      "correct_answer",
      "difficulty",
      "notes",
      "created_at",
      "updated_at",
    ],
    primaryKey: ["id"],
    scope: "user",
  },
] as const;

export const ACCOUNT_BACKUP_TABLES: readonly TableName[] = TABLES.map((table) => table.name);

const MEDIA_COLUMNS = [
  "id",
  "user_id",
  "year",
  "month",
  "title",
  "file_path",
  "file_type",
  "file_size",
  "created_at",
] as const;

const FORMAT = "markznet-account-backup";
const VERSION = 1;
const JSON_COLUMNS: Partial<Record<TableName | "media", readonly string[]>> = {
  students: ["custom_fields"],
  exam_questions: ["choices"],
};
const STUDENT_LINKED_TABLES = new Set<TableName>([
  "hifz_history",
  "year_data",
  "internal_competitions",
  "external_competitions",
  "monthly_tracking",
  "monthly_submissions",
]);

export interface AccountBackup {
  format: typeof FORMAT;
  version: typeof VERSION;
  createdAt: string;
  tables: Record<TableName, DbRow[]>;
  accountSettings: Array<{ key: string; value: unknown }>;
  media: Array<{
    metadata: DbRow;
    mimeType: string;
    dataBase64: string;
    checksum: string;
  }>;
}

export interface TableRestorePreview {
  table: TableName;
  incoming: number;
  added: number;
  matched: number;
  filled: number;
  skipped: number;
}

export interface AccountBackupPreview {
  createdAt: string;
  tables: TableRestorePreview[];
  settings: { incoming: number; added: number; matched: number; filled: number };
  media: { incoming: number; added: number; matched: number; filled: number };
  totalAdded: number;
  totalMatched: number;
  totalFilled: number;
  totalSkipped: number;
}

interface SqlAction {
  statement: string;
  values: DbValue[];
}

interface MediaWrite {
  key: string;
  blob: Blob;
}

interface RestorePlan {
  preview: AccountBackupPreview;
  sqlActions: SqlAction[];
  mediaWrites: MediaWrite[];
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const requireString = (value: unknown, label: string): string => {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`ملف النسخة الاحتياطية غير صالح: قيمة ${label} مفقودة.`);
  }
  return value;
};

const requireId = (value: unknown, label: string): string | number => {
  if ((typeof value !== "string" && typeof value !== "number") || String(value).trim() === "") {
    throw new Error(`ملف النسخة الاحتياطية غير صالح: معرّف ${label} مفقود.`);
  }
  return value;
};

const sqlValue = (value: unknown, table: TableName | "media", column: string): DbValue => {
  if (value === undefined || value === null) return null;
  if (typeof value === "string" || typeof value === "number") {
    if (typeof value === "number" && !Number.isFinite(value)) {
      throw new Error(`ملف النسخة الاحتياطية غير صالح: قيمة رقمية في ${table}.${column}.`);
    }
    return value;
  }
  if (typeof value === "boolean") return value ? 1 : 0;
  if ((JSON_COLUMNS[table] ?? []).includes(column)) {
    try {
      return JSON.stringify(value);
    } catch {
      throw new Error(`ملف النسخة الاحتياطية غير صالح: JSON في ${table}.${column}.`);
    }
  }
  throw new Error(`ملف النسخة الاحتياطية غير صالح: نوع بيانات غير مدعوم في ${table}.${column}.`);
};

const sanitizeRow = (table: TableConfig, input: unknown): DbRow => {
  if (!isRecord(input)) throw new Error(`ملف النسخة الاحتياطية غير صالح: صف في ${table.name}.`);
  const result: DbRow = {};
  for (const column of table.columns) result[column] = sqlValue(input[column], table.name, column);

  if (table.primaryKey.includes("id")) {
    const value = result.id;
    requireId(value, table.name);
  }
  if (table.name === "students") {
    if (!Number.isSafeInteger(Number(result.id)) || Number(result.id) < 1) {
      throw new Error("ملف النسخة الاحتياطية غير صالح: معرّف طالب غير صحيح.");
    }
    if (typeof result.name !== "string")
      throw new Error("ملف النسخة الاحتياطية غير صالح: اسم طالب.");
  } else if (table.name === "hifz_history") {
    if (!Number.isSafeInteger(Number(result.student_id)))
      throw new Error("معرّف طالب غير صالح في سجل الحفظ.");
    requireString(result.year_key, "مفتاح عام الحفظ");
  } else if (table.name === "year_data") {
    if (!Number.isSafeInteger(Number(result.student_id)))
      throw new Error("معرّف طالب غير صالح في بيانات العام.");
    requireString(result.year, "العام");
  } else if (STUDENT_LINKED_TABLES.has(table.name)) {
    if (!Number.isSafeInteger(Number(result.student_id)) || Number(result.student_id) < 1) {
      throw new Error(`معرّف طالب غير صالح في ${table.name}.`);
    }
  }
  return result;
};

const sanitizeMediaMetadata = (input: unknown): DbRow => {
  if (!isRecord(input)) throw new Error("ملف النسخة الاحتياطية غير صالح: بيانات وسيط.");
  const row: DbRow = {};
  for (const column of MEDIA_COLUMNS) row[column] = sqlValue(input[column], "media", column);
  requireId(row.id, "وسيط");
  requireString(row.file_path, "مسار الوسيط");
  if (row.file_type !== "image" && row.file_type !== "video") {
    throw new Error("ملف النسخة الاحتياطية غير صالح: نوع وسيط غير معروف.");
  }
  return row;
};

const decodeBase64 = (value: string): Uint8Array => {
  try {
    const binary = atob(value);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes;
  } catch {
    throw new Error("ملف النسخة الاحتياطية غير صالح: تعذّر فك ملف وسيط.");
  }
};

/** يتحقق من نوع الملف وإصدار المخطط ويزيل أي أعمدة أو جداول غير مسموحة. */
export const parseAccountBackup = (input: unknown): AccountBackup => {
  if (!isRecord(input) || input.format !== FORMAT || input.version !== VERSION) {
    throw new Error("الملف ليس نسخة احتياطية معروفة لـ Markz Net أو أن إصداره غير مدعوم.");
  }
  if (!isRecord(input.tables)) throw new Error("ملف النسخة الاحتياطية لا يحتوي جداول البيانات.");
  const knownTables = new Set(TABLES.map((table) => table.name));
  for (const name of Object.keys(input.tables)) {
    if (!knownTables.has(name as TableName)) {
      throw new Error(
        `الملف يحتوي جدولاً غير مدعوم (${name})؛ لن تُستورد حسابات الدخول أو الجداول الأخرى.`,
      );
    }
  }

  const tables = {} as Record<TableName, DbRow[]>;
  for (const table of TABLES) {
    const rows = input.tables[table.name];
    if (!Array.isArray(rows)) {
      throw new Error(`ملف النسخة الاحتياطية ناقص: جدول ${table.name}.`);
    }
    tables[table.name] = rows.map((row) => sanitizeRow(table, row));
  }

  if (!Array.isArray(input.accountSettings)) {
    throw new Error("ملف النسخة الاحتياطية ناقص: إعدادات الحساب.");
  }
  const seenSettings = new Set<string>();
  const accountSettings = input.accountSettings.map((setting) => {
    if (!isRecord(setting)) throw new Error("إعداد حساب غير صالح في ملف النسخة الاحتياطية.");
    const key = requireString(setting.key, "مفتاح إعداد");
    if (key.includes(":") || key.startsWith("markznet.")) {
      throw new Error("مفتاح إعداد غير صالح في ملف النسخة الاحتياطية.");
    }
    if (seenSettings.has(key)) throw new Error(`إعداد مكرر في ملف النسخة الاحتياطية: ${key}.`);
    seenSettings.add(key);
    return { key, value: setting.value };
  });

  if (!Array.isArray(input.media)) throw new Error("ملف النسخة الاحتياطية ناقص: ملفات الوسائط.");
  const media = input.media.map((item) => {
    if (!isRecord(item)) throw new Error("بيانات وسيط غير صالحة في ملف النسخة الاحتياطية.");
    const metadata = sanitizeMediaMetadata(item.metadata);
    const mimeType = typeof item.mimeType === "string" ? item.mimeType : "application/octet-stream";
    const dataBase64 = typeof item.dataBase64 === "string" ? item.dataBase64 : "";
    const checksum = requireString(item.checksum, "بصمة وسيط");
    const bytes = decodeBase64(dataBase64);
    if (Number(metadata.file_size) !== bytes.byteLength) {
      throw new Error(
        `حجم ملف الوسيط «${String(metadata.title ?? "بدون عنوان")}» لا يطابق بياناته.`,
      );
    }
    return { metadata, mimeType, dataBase64, checksum };
  });

  const createdAt = requireString(input.createdAt, "تاريخ إنشاء النسخة");
  return { format: FORMAT, version: VERSION, createdAt, tables, accountSettings, media };
};

export const parseAccountBackupText = (text: string): AccountBackup => {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("تعذّر قراءة الملف؛ تأكد أنه ملف JSON صالح.");
  }
  return parseAccountBackup(parsed);
};

const readRows = async (
  db: Awaited<ReturnType<typeof getDB>>,
  sql: string,
  values: Array<string | number> = [],
) => {
  const result = await db.query(sql, values);
  return (result.values ?? []) as DbRow[];
};

const readOwnedTable = async (
  db: Awaited<ReturnType<typeof getDB>>,
  table: TableConfig,
  userId: string,
): Promise<DbRow[]> => {
  if (table.scope === "user") {
    return readRows(db, `SELECT * FROM ${table.name} WHERE user_id = ?`, [userId]);
  }
  // لا تحتوي هاتان الجدولان user_id؛ نربطهما بطلاب المالك مباشرةً لتجنب
  // حدّ SQLite لعدد معاملات IN ولضمان عزل بيانات الحساب.
  return readRows(
    db,
    `SELECT ${table.name}.* FROM ${table.name} INNER JOIN students s ON s.id = ${table.name}.student_id WHERE s.user_id = ?`,
    [userId],
  );
};

const settingValueFromDb = (value: unknown): unknown => {
  if (typeof value !== "string") return value ?? null;
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
};

const stringifySetting = (value: unknown): string => {
  try {
    return JSON.stringify(value ?? null);
  } catch {
    throw new Error("تعذّر ترميز إعداد الحساب إلى JSON.");
  }
};

const bytesToBase64 = (bytes: Uint8Array): string => {
  let binary = "";
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
};

const checksumBytes = async (bytes: Uint8Array): Promise<string> => {
  // بصمة ثابتة بين HTTP المحلي وHTTPS (Web Crypto غير متاحة دائماً على LAN).
  // تستخدم لاكتشاف الوسائط المتكررة/التلف، وليست وسيلة تحقق تشفيري.
  let left = 0x811c9dc5;
  let right = 0x9e3779b9;
  for (let i = 0; i < bytes.length; i++) {
    left = Math.imul(left ^ bytes[i], 0x01000193);
    right = Math.imul(right ^ bytes[i] ^ i, 0x85ebca6b);
  }
  return `fnv2:${bytes.length.toString(16)}:${(left >>> 0).toString(16)}${(right >>> 0).toString(16)}`;
};

const getOwnerForExport = async (): Promise<string> => {
  const ownerId = getViewAsId() ?? (await getSessionUserId());
  if (!ownerId) throw new Error("يلزم تسجيل الدخول لإنشاء نسخة احتياطية.");
  return ownerId;
};

const requireWritableOwner = async (): Promise<string> => {
  if (isViewingOtherUser()) {
    throw new Error("أنت في وضع الاطلاع على بيانات مستخدم آخر — استعادة البيانات غير مسموحة.");
  }
  const ownerId = await getSessionUserId();
  if (!ownerId) throw new Error("يلزم تسجيل الدخول لاستعادة نسخة احتياطية.");
  return ownerId;
};

/** يصدر ملف JSON واحداً لبيانات الحساب الحالي (أو الحساب المعروض للقراءة فقط). */
export const createAccountBackup = async (): Promise<AccountBackup> => {
  const userId = await getOwnerForExport();
  const db = await getDB();
  const students = await readRows(db, "SELECT * FROM students WHERE user_id = ?", [userId]);
  const tables = {} as Record<TableName, DbRow[]>;
  for (const table of TABLES) {
    tables[table.name] =
      table.name === "students" ? students : await readOwnedTable(db, table, userId);
  }

  const settingRows = await readRows(db, "SELECT key, value FROM settings");
  const prefix = `${userId}:`;
  const accountSettings = settingRows
    .filter((setting) => typeof setting.key === "string" && setting.key.startsWith(prefix))
    .map((setting) => ({
      key: String(setting.key).slice(prefix.length),
      value: settingValueFromDb(setting.value),
    }));

  const mediaRows = await readRows(db, "SELECT * FROM media WHERE user_id = ?", [userId]);
  const media: AccountBackup["media"] = [];
  for (const metadata of mediaRows) {
    const path = String(metadata.file_path ?? "");
    const file = path ? await getMediaFile(path) : null;
    if (!file) {
      throw new Error(
        `تعذّر إنشاء النسخة: ملف الوسيط «${String(metadata.title ?? path)}» غير موجود في المخزن المحلي.`,
      );
    }
    const bytes = new Uint8Array(await file.arrayBuffer());
    media.push({
      metadata,
      mimeType: file.type || "application/octet-stream",
      dataBase64: bytesToBase64(bytes),
      checksum: await checksumBytes(bytes),
    });
  }

  return {
    format: FORMAT,
    version: VERSION,
    createdAt: new Date().toISOString(),
    tables,
    accountSettings,
    media,
  };
};

const keyText = (value: unknown): string =>
  typeof value === "string"
    ? value.trim().replace(/\s+/g, " ").toLocaleLowerCase("ar")
    : String(value ?? "");
const keyName = (value: unknown): string =>
  typeof value === "string" ? normalizeStudentName(value) : String(value ?? "");
const tuple = (parts: unknown[]): string => JSON.stringify(parts.map((part) => part ?? null));
const blank = (value: unknown): boolean => {
  if (value === undefined || value === null) return true;
  if (typeof value === "string") return value.trim() === "";
  if (Array.isArray(value)) return value.length === 0;
  if (isRecord(value)) return Object.keys(value).length === 0;
  return false;
};

const naturalKey = (table: TableName, row: DbRow): string => {
  switch (table) {
    case "students": {
      const name = keyName(row.name);
      return name ? tuple(["name", name]) : tuple(["id", row.id]);
    }
    case "hifz_history":
      return tuple([row.student_id, row.year_key]);
    case "year_data":
      return tuple([row.student_id, row.year]);
    case "teachers":
      return keyName(row.name) ? tuple([keyName(row.name), row.year]) : tuple(["id", row.id]);
    case "teacher_bonuses":
      return keyName(row.teacher_name)
        ? tuple([keyName(row.teacher_name), row.year, row.month])
        : tuple(["id", row.id]);
    case "donors":
      return keyName(row.name) ? tuple([row.year, keyName(row.name)]) : tuple(["id", row.id]);
    case "awards":
      return keyName(row.recipient_name)
        ? tuple([
            row.year,
            keyText(row.recipient_type),
            keyName(row.recipient_name),
            keyText(row.award_type),
            row.awarded_at,
          ])
        : tuple(["id", row.id]);
    case "ceremony_expenses":
      return keyText(row.description)
        ? tuple([row.year, row.spent_at, keyText(row.category), keyText(row.description)])
        : tuple(["id", row.id]);
    case "certificates":
      return keyName(row.recipient_name)
        ? tuple([
            row.year,
            keyText(row.recipient_type),
            keyName(row.recipient_name),
            keyText(row.cert_type),
            row.issued_at,
          ])
        : tuple(["id", row.id]);
    case "internal_competitions":
      return keyText(row.competition_name)
        ? tuple([
            row.student_id,
            row.year,
            keyText(row.competition_name),
            keyText(row.category),
            row.date,
          ])
        : tuple(["id", row.id]);
    case "external_competitions":
      return keyText(row.competition_name)
        ? tuple([
            row.student_id,
            row.year,
            keyText(row.competition_name),
            keyText(row.organizer),
            keyText(row.category),
            row.date,
          ])
        : tuple(["id", row.id]);
    case "monthly_tracking":
      return tuple([row.student_id, row.year, row.month]);
    case "teacher_portals":
      return keyName(row.teacher_name)
        ? tuple([keyName(row.teacher_name), row.year, row.month])
        : tuple(["id", row.id]);
    case "monthly_submissions":
      if (row.portal_id)
        return tuple(["portal", row.portal_id, row.student_id, row.year, row.month]);
      if (row.source === "manual") return tuple(["manual", row.student_id, row.year, row.month]);
      return tuple(["unlinked-portal", row.code, row.student_id, row.year, row.month]);
    case "community_records":
      return keyName(row.beneficiary_name)
        ? tuple([
            keyText(row.department),
            keyText(row.program_id),
            keyName(row.beneficiary_name),
            row.service_date,
          ])
        : tuple(["id", row.id]);
    case "exam_questions":
      return keyText(row.question)
        ? tuple([
            row.year,
            keyText(row.category),
            keyText(row.subject),
            keyText(row.question_type),
            keyText(row.question),
          ])
        : tuple(["id", row.id]);
  }
};

const parseCustomFields = (value: unknown): Record<string, unknown> => {
  if (isRecord(value)) return value;
  if (typeof value === "string") {
    try {
      const parsed: unknown = JSON.parse(value);
      return isRecord(parsed) ? parsed : {};
    } catch {
      return {};
    }
  }
  return {};
};

const mergeCustomFields = (
  existing: unknown,
  incoming: unknown,
): { value: DbValue; changed: boolean } => {
  const current = parseCustomFields(existing);
  const source = parseCustomFields(incoming);
  const merged = { ...current };
  let changed = false;
  for (const [key, value] of Object.entries(source)) {
    if (blank(merged[key]) && !blank(value)) {
      merged[key] = value;
      changed = true;
    }
  }
  return changed
    ? { value: JSON.stringify(merged), changed }
    : { value: (existing as DbValue) ?? null, changed: false };
};

const mergeBlankFields = (
  table: TableConfig,
  existing: DbRow,
  incoming: DbRow,
  replaceableUniqueCodes?: Set<string>,
): { merged: DbRow; changed: boolean } => {
  const merged = { ...existing };
  let changed = false;
  for (const column of table.columns) {
    if (table.primaryKey.includes(column) || column === "user_id") continue;
    if (table.name === "students" && column === "custom_fields") {
      const result = mergeCustomFields(existing[column], incoming[column]);
      if (result.changed) {
        merged[column] = result.value;
        changed = true;
      }
      continue;
    }
    if (column === "code" && table.name === "teacher_portals" && replaceableUniqueCodes) {
      const candidate = incoming[column];
      const current = existing[column];
      if (blank(current) && !blank(candidate) && !replaceableUniqueCodes.has(String(candidate))) {
        merged[column] = candidate;
        changed = true;
      }
      continue;
    }
    if (blank(existing[column]) && !blank(incoming[column])) {
      merged[column] = incoming[column];
      changed = true;
    }
  }
  return { merged, changed };
};

const queryAllIds = async (
  db: Awaited<ReturnType<typeof getDB>>,
  table: TableConfig,
): Promise<Set<string>> => {
  if (!table.primaryKey.includes("id")) return new Set();
  const rows = await readRows(db, `SELECT id FROM ${table.name}`);
  return new Set(rows.map((row) => String(row.id)));
};

const idForWhere = (table: TableConfig, row: DbRow): DbValue[] =>
  table.primaryKey.map((column) => row[column] ?? null);

const updateAction = (table: TableConfig, before: DbRow, after: DbRow): SqlAction | null => {
  const changedColumns = table.columns.filter(
    (column) =>
      !table.primaryKey.includes(column) &&
      column !== "user_id" &&
      JSON.stringify(before[column] ?? null) !== JSON.stringify(after[column] ?? null),
  );
  if (changedColumns.length === 0) return null;
  const setSql = changedColumns.map((column) => `${column} = ?`).join(", ");
  const whereSql = table.primaryKey.map((column) => `${column} = ?`).join(" AND ");
  return {
    statement: `UPDATE ${table.name} SET ${setSql} WHERE ${whereSql}`,
    values: [
      ...changedColumns.map((column) => after[column] ?? null),
      ...idForWhere(table, before),
    ],
  };
};

const insertAction = (table: TableConfig, row: DbRow): SqlAction => {
  const columns = table.columns;
  const placeholders = columns.map(() => "?").join(", ");
  return {
    statement: `INSERT INTO ${table.name} (${columns.join(", ")}) VALUES (${placeholders})`,
    values: columns.map((column) => row[column] ?? null),
  };
};

const makeLocalId = (): string => {
  if (typeof globalThis.crypto?.randomUUID === "function") return globalThis.crypto.randomUUID();
  return `restore-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
};

const CODE_ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789";
const newPortalCode = (taken: Set<string>): string => {
  for (let attempt = 0; attempt < 100; attempt++) {
    let code = "";
    for (let i = 0; i < 8; i++)
      code += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
    if (!taken.has(code)) {
      taken.add(code);
      return code;
    }
  }
  const fallback = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  taken.add(fallback);
  return fallback;
};

const mediaExt = (path: string, mimeType: string): string => {
  const match = path.split(/[?#]/)[0].match(/\.([a-zA-Z0-9]{1,8})$/);
  if (match) return match[1].toLowerCase();
  const subtype = mimeType.split("/")[1]?.split(";")[0]?.toLowerCase() ?? "bin";
  return /^[a-z0-9]{1,8}$/.test(subtype) ? subtype : "bin";
};

const mediaNaturalKey = (metadata: DbRow, checksum: string): string =>
  tuple([metadata.year, metadata.month, keyText(metadata.title), metadata.file_type, checksum]);

const rowForDb = (table: TableConfig, row: DbRow): DbRow => {
  const result: DbRow = {};
  for (const column of table.columns) {
    const value = row[column];
    result[column] = sqlValue(value, table.name, column);
  }
  return result;
};

const buildRestorePlan = async (backup: AccountBackup, userId: string): Promise<RestorePlan> => {
  const db = await getDB();
  const currentStudents = await readRows(db, "SELECT * FROM students WHERE user_id = ?", [userId]);
  const allStudentIds = await readRows(db, "SELECT id FROM students");
  const globalStudentIds = new Set(allStudentIds.map((row) => Number(row.id)));
  let nextStudentId = Array.from(globalStudentIds).reduce(
    (maximum, id) => (Number.isSafeInteger(id) ? Math.max(maximum, id) : maximum),
    0,
  );

  const currentRows = new Map<TableName, DbRow[]>();
  for (const table of TABLES) {
    currentRows.set(
      table.name,
      table.name === "students" ? currentStudents : await readOwnedTable(db, table, userId),
    );
  }

  const globalIds = new Map<TableName, Set<string>>();
  for (const table of TABLES) globalIds.set(table.name, await queryAllIds(db, table));
  const allPortals = await readRows(
    db,
    "SELECT id, user_id, teacher_name, code, year, month, active, created_at, updated_at FROM teacher_portals",
  );
  const usedPortalCodes = new Set(allPortals.map((row) => String(row.code ?? "")).filter(Boolean));

  const sqlActions: SqlAction[] = [];
  const studentIdMap = new Map<string, number>();
  const portalIdMap = new Map<string, string>();
  const portalCodeMap = new Map<string, string>();
  const portalIdBySourceCode = new Map<string, string>();
  const previews: TableRestorePreview[] = [];
  const settingsPreview = {
    incoming: backup.accountSettings.length,
    added: 0,
    matched: 0,
    filled: 0,
  };

  for (const table of TABLES) {
    const rows = currentRows.get(table.name) ?? [];
    const rowsByKey = new Map<string, DbRow>();
    const studentsByName = new Map<string, DbRow[]>();
    for (const row of [...rows].sort((a, b) => Number(a.id ?? 0) - Number(b.id ?? 0))) {
      rowsByKey.set(naturalKey(table.name, row), row);
      if (table.name === "students") {
        const name = keyName(row.name);
        if (name) studentsByName.set(name, [...(studentsByName.get(name) ?? []), row]);
      }
    }

    const tablePreview: TableRestorePreview = {
      table: table.name,
      incoming: backup.tables[table.name].length,
      added: 0,
      matched: 0,
      filled: 0,
      skipped: 0,
    };
    const availableIds = globalIds.get(table.name) ?? new Set<string>();

    for (const original of backup.tables[table.name]) {
      let row: DbRow = { ...original };
      const sourceId = String(row.id ?? "");

      if (table.name === "students") {
        const name = keyName(row.name);
        const nameMatches = name ? (studentsByName.get(name) ?? []) : [];
        const idMatch = nameMatches.find((candidate) => String(candidate.id) === sourceId);
        const existing = idMatch ?? nameMatches[0] ?? rowsByKey.get(naturalKey(table.name, row));
        if (existing) {
          row.id = Number(existing.id);
          row.user_id = userId;
          studentIdMap.set(sourceId, Number(existing.id));
          tablePreview.matched++;
          const merged = mergeBlankFields(table, existing, row);
          if (merged.changed) {
            const action = updateAction(table, existing, merged.merged);
            if (action) sqlActions.push(action);
            rowsByKey.set(naturalKey(table.name, merged.merged), merged.merged);
            const list = studentsByName.get(name) ?? [];
            const index = list.findIndex((item) => Number(item.id) === Number(existing.id));
            if (index >= 0) list[index] = merged.merged;
            tablePreview.filled++;
          }
          continue;
        }

        const sourceNumericId = Number(row.id);
        if (
          Number.isSafeInteger(sourceNumericId) &&
          sourceNumericId > 0 &&
          !globalStudentIds.has(sourceNumericId)
        ) {
          row.id = sourceNumericId;
          nextStudentId = Math.max(nextStudentId, sourceNumericId);
        } else {
          do {
            nextStudentId++;
          } while (globalStudentIds.has(nextStudentId));
          row.id = nextStudentId;
        }
        globalStudentIds.add(Number(row.id));
        availableIds.add(String(row.id));
        row.user_id = userId;
        row = rowForDb(table, row);
        sqlActions.push(insertAction(table, row));
        rowsByKey.set(naturalKey(table.name, row), row);
        if (name) studentsByName.set(name, [...(studentsByName.get(name) ?? []), row]);
        studentIdMap.set(sourceId, Number(row.id));
        tablePreview.added++;
        continue;
      }

      if (STUDENT_LINKED_TABLES.has(table.name)) {
        const mappedStudentId = studentIdMap.get(String(row.student_id));
        if (!mappedStudentId) {
          tablePreview.skipped++;
          continue;
        }
        row.student_id = mappedStudentId;
      }
      if (table.scope === "user") row.user_id = userId;

      if (table.name === "teacher_portals") {
        const oldCode = String(row.code ?? "");
        const existing = rowsByKey.get(naturalKey(table.name, row));
        if (existing) {
          row.id = existing.id;
          row.user_id = userId;
          // Keep the backup's code as a candidate so a blank local code can be filled safely.
          row.code = oldCode;
          tablePreview.matched++;
          if (sourceId) portalIdMap.set(sourceId, String(existing.id));
          const merged = mergeBlankFields(table, existing, row, usedPortalCodes);
          if (merged.changed) {
            const action = updateAction(table, existing, merged.merged);
            if (action) sqlActions.push(action);
            rowsByKey.set(naturalKey(table.name, merged.merged), merged.merged);
            tablePreview.filled++;
          }
          if (oldCode) {
            const targetCode = String(merged.merged.code ?? oldCode);
            if (targetCode) usedPortalCodes.add(targetCode);
            portalCodeMap.set(oldCode, targetCode);
            portalIdBySourceCode.set(oldCode, String(existing.id));
          }
          continue;
        }

        let code = oldCode;
        if (!code || usedPortalCodes.has(code)) code = newPortalCode(usedPortalCodes);
        else usedPortalCodes.add(code);
        row.code = code;
        if (!sourceId || availableIds.has(sourceId)) row.id = makeLocalId();
        availableIds.add(String(row.id));
        row.user_id = userId;
        row = rowForDb(table, row);
        sqlActions.push(insertAction(table, row));
        rowsByKey.set(naturalKey(table.name, row), row);
        if (sourceId) portalIdMap.set(sourceId, String(row.id));
        if (oldCode) {
          portalCodeMap.set(oldCode, code);
          portalIdBySourceCode.set(oldCode, String(row.id));
        }
        tablePreview.added++;
        continue;
      }

      if (table.name === "monthly_submissions") {
        const sourcePortalId = String(row.portal_id ?? "");
        const sourceCode = String(row.code ?? "");
        const mappedPortalId =
          portalIdMap.get(sourcePortalId) ?? portalIdBySourceCode.get(sourceCode);
        if (sourcePortalId && mappedPortalId) row.portal_id = mappedPortalId;
        else if (sourcePortalId) row.portal_id = null;
        if (sourceCode && portalCodeMap.has(sourceCode)) row.code = portalCodeMap.get(sourceCode)!;
      }

      const existing = rowsByKey.get(naturalKey(table.name, row));
      if (existing) {
        row.id = existing.id ?? row.id;
        row.user_id = userId;
        tablePreview.matched++;
        const merged = mergeBlankFields(table, existing, row, usedPortalCodes);
        if (merged.changed) {
          const action = updateAction(table, existing, merged.merged);
          if (action) sqlActions.push(action);
          rowsByKey.set(naturalKey(table.name, merged.merged), merged.merged);
          tablePreview.filled++;
        }
        continue;
      }

      if (table.primaryKey.includes("id")) {
        if (!sourceId || availableIds.has(sourceId)) row.id = makeLocalId();
        availableIds.add(String(row.id));
      }
      row = rowForDb(table, row);
      sqlActions.push(insertAction(table, row));
      rowsByKey.set(naturalKey(table.name, row), row);
      tablePreview.added++;
    }
    previews.push(tablePreview);
  }

  const settingRows = await readRows(db, "SELECT key, value FROM settings");
  const settingPrefix = `${userId}:`;
  const targetSettings = new Map(
    settingRows
      .filter((row) => typeof row.key === "string" && row.key.startsWith(settingPrefix))
      .map((row) => [String(row.key), settingValueFromDb(row.value)]),
  );
  const seenSettings = new Set<string>();
  for (const setting of backup.accountSettings) {
    const key = `${settingPrefix}${setting.key}`;
    if (seenSettings.has(key)) continue;
    seenSettings.add(key);
    if (!targetSettings.has(key)) {
      sqlActions.push({
        statement: "INSERT INTO settings (key, value) VALUES (?, ?)",
        values: [key, stringifySetting(setting.value)],
      });
      targetSettings.set(key, setting.value);
      settingsPreview.added++;
      continue;
    }
    settingsPreview.matched++;
    const existing = targetSettings.get(key);
    if (blank(existing) && !blank(setting.value)) {
      sqlActions.push({
        statement: "UPDATE settings SET value = ? WHERE key = ?",
        values: [stringifySetting(setting.value), key],
      });
      targetSettings.set(key, setting.value);
      settingsPreview.filled++;
    }
  }

  const existingMedia = await readRows(db, "SELECT * FROM media WHERE user_id = ?", [userId]);
  const existingMediaIds = await queryAllIds(db, {
    name: "media" as TableName,
    columns: MEDIA_COLUMNS,
    primaryKey: ["id"],
    scope: "user",
  });
  const existingMediaKeys = new Map<string, DbRow>();
  for (const metadata of existingMedia) {
    const file = await getMediaFile(String(metadata.file_path ?? ""));
    if (!file) continue;
    const checksum = await checksumBytes(new Uint8Array(await file.arrayBuffer()));
    existingMediaKeys.set(mediaNaturalKey(metadata, checksum), metadata);
  }

  const mediaPreview = { incoming: backup.media.length, added: 0, matched: 0, filled: 0 };
  const mediaWrites: MediaWrite[] = [];
  const mediaRowsByKey = existingMediaKeys;
  for (const item of backup.media) {
    const bytes = decodeBase64(item.dataBase64);
    const actualChecksum = await checksumBytes(bytes);
    if (actualChecksum !== item.checksum) {
      throw new Error(
        `بصمة ملف الوسيط «${String(item.metadata.title ?? "بدون عنوان")}» غير صحيحة.`,
      );
    }
    const key = mediaNaturalKey(item.metadata, item.checksum);
    const existing = mediaRowsByKey.get(key);
    if (existing) {
      mediaPreview.matched++;
      const merged: DbRow = { ...existing };
      let changed = false;
      for (const column of MEDIA_COLUMNS) {
        if (column === "id" || column === "user_id" || column === "file_path") continue;
        if (blank(merged[column]) && !blank(item.metadata[column])) {
          merged[column] = item.metadata[column];
          changed = true;
        }
      }
      if (changed) {
        const changedColumns = MEDIA_COLUMNS.filter(
          (column) =>
            !["id", "user_id", "file_path"].includes(column) &&
            JSON.stringify(existing[column] ?? null) !== JSON.stringify(merged[column] ?? null),
        );
        if (changedColumns.length) {
          sqlActions.push({
            statement: `UPDATE media SET ${changedColumns.map((column) => `${column} = ?`).join(", ")} WHERE id = ?`,
            values: [
              ...changedColumns.map((column) => merged[column] ?? null),
              existing.id as DbValue,
            ],
          });
          mediaPreview.filled++;
        }
      }
      continue;
    }

    const metadata: DbRow = { ...item.metadata, user_id: userId };
    if (existingMediaIds.has(String(metadata.id))) metadata.id = makeLocalId();
    existingMediaIds.add(String(metadata.id));
    const bytesBuffer = bytes.slice().buffer as ArrayBuffer;
    const blob = new Blob([bytesBuffer], { type: item.mimeType });
    const ext = mediaExt(String(metadata.file_path ?? ""), item.mimeType);
    const path = makeMediaKey(userId, ext);
    metadata.file_path = path;
    metadata.file_size = bytes.byteLength;
    const mediaRow: DbRow = {};
    for (const column of MEDIA_COLUMNS)
      mediaRow[column] = sqlValue(metadata[column], "media", column);
    sqlActions.push({
      statement: `INSERT INTO media (${MEDIA_COLUMNS.join(", ")}) VALUES (${MEDIA_COLUMNS.map(() => "?").join(", ")})`,
      values: MEDIA_COLUMNS.map((column) => mediaRow[column] ?? null),
    });
    mediaWrites.push({ key: path, blob });
    mediaRowsByKey.set(key, mediaRow);
    mediaPreview.added++;
  }

  const totalAdded =
    previews.reduce((sum, item) => sum + item.added, 0) +
    settingsPreview.added +
    mediaPreview.added;
  const totalMatched =
    previews.reduce((sum, item) => sum + item.matched, 0) +
    settingsPreview.matched +
    mediaPreview.matched;
  const totalFilled =
    previews.reduce((sum, item) => sum + item.filled, 0) +
    settingsPreview.filled +
    mediaPreview.filled;
  const totalSkipped = previews.reduce((sum, item) => sum + item.skipped, 0);

  return {
    preview: {
      createdAt: backup.createdAt,
      tables: previews,
      settings: settingsPreview,
      media: mediaPreview,
      totalAdded,
      totalMatched,
      totalFilled,
      totalSkipped,
    },
    sqlActions,
    mediaWrites,
  };
};

/** معاينة حسابية فقط؛ لا تكتب في قاعدة البيانات أو مخزن الوسائط. */
export const previewAccountBackup = async (
  input: AccountBackup | unknown,
): Promise<AccountBackupPreview> => {
  const backup = parseAccountBackup(input);
  const userId = await requireWritableOwner();
  const plan = await buildRestorePlan(backup, userId);
  return plan.preview;
};

/**
 * الاستعادة دمج دائماً: لا تحذف ولا تستبدل. يملأ فراغات المطابق بالاسم،
 * يعيد ربط صفوفه بمعرّفه المحلي، ويطابق بقية البيانات بمفاتيح طبيعية.
 */
export const restoreAccountBackup = async (
  input: AccountBackup | unknown,
): Promise<AccountBackupPreview> => {
  const backup = parseAccountBackup(input);
  const userId = await requireWritableOwner();
  const plan = await buildRestorePlan(backup, userId);
  if ((await requireWritableOwner()) !== userId) {
    throw new Error("تغيّر الحساب أثناء الاستعادة؛ أعد المحاولة.");
  }

  const writtenMediaKeys: string[] = [];
  try {
    for (const media of plan.mediaWrites) {
      await putMediaFile(media.key, media.blob);
      writtenMediaKeys.push(media.key);
    }
    if (plan.sqlActions.length > 0) {
      await (await getDB()).executeSet(plan.sqlActions, true);
      await persistNow();
    }
  } catch (error) {
    await deleteMediaFiles(writtenMediaKeys);
    throw error;
  }
  return plan.preview;
};
