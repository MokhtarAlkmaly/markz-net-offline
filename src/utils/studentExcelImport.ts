/**
 * استيراد Excel للسجل الشامل (كل الأعوام).
 *
 * يفصل هذا الملف بين:
 *  1) التحليل الخالص: صفوف Excel (من `sheet_to_json`) → سجلات موحّدة.
 *  2) التطبيق على قاعدة البيانات: تحديث سجل مطابق بالاسم أو إنشاء سجل جديد،
 *     وتسجيل الأعوام المذكورة في `year_data` حتى تظهر في «الأعوام المسجل بها».
 *  3) بناء قالب Excel ورؤوسه مع إرشادات الاستخدام.
 *
 * الأعمدة الافتراضية تطابق تماماً أعمدة تصدير السجل الشامل في
 * `StudentsTable.tsx`، فملف التصدير يُعاد استيراده بلا أي تعديل يدوي.
 */

import { normalizeStudentName } from "./studentNames";
import { loadGlobalStudentsWithYears, saveStudent, saveYearData, loadYearData } from "./storage";
import type { Student, CustomColumnDef, YearData } from "@/types/student";

// ===========================================================================
// الأنواع
// ===========================================================================

/** سجل واحد بعد التحليل (قبل الحفظ). */
export interface ParsedStudentRow {
  /** اسم الطالب كما ظهر في الملف (بعد trim). */
  name: string;
  gender?: string;
  hijri_join_date?: string;
  initial_hifz?: string;
  first_competition_year?: string;
  status?: string;
  school_grade?: string;
  guardian_phone?: string;
  student_phone?: string;
  notes?: string;
  /** الأعوام المسجل بها (صيغة موحّدة: 1441، 1447D). */
  registered_years?: string[];
  /** آخر حفظ تراكمي — يُسجَّل في آخر عام مسجل. */
  latest_total_hifz?: string;
  /** قيم الأعمدة المخصصة (id العمود → القيمة). */
  custom_fields: Record<string, string>;
  /** رقم الصف في ملف Excel (لرسائل الخطأ). */
  rowNumber: number;
  /** أرقام الصفوف المكررة داخل الملف التي دُمجت في هذا السجل. */
  mergedFrom?: number[];
}

export interface StudentImportResult {
  /** طلاب جدد أُنشئوا. */
  imported: number;
  /** سجلات مطابقة بالاسم حُدّثت. */
  updated: number;
  /** صفوف تُركت (بلا اسم أو فشل حفظ). */
  skipped: number;
  /** أسماء الصفوف المكررة داخل الملف نفسه التي دُمجت في سطر واحد. */
  mergedDuplicates: number;
  /** رسائل أخطاء/تحذيرات بالعربية. */
  errors: string[];
  /** إجمالي الصفوف المقروءة من الملف. */
  total: number;
}

// ===========================================================================
// رؤوس الأعمدة
// ===========================================================================

/** رؤوس القالب المجاني — نفس أعمدة تصدير السجل الشامل. */
export const STUDENT_IMPORT_HEADERS = [
  "م",
  "رقم القيد",
  "اسم الطالب",
  "الجنس",
  "تاريخ هجري الالتحاق",
  "الحفظ قبل الالتحاق",
  "الحفظ التراكمي (آخر عام)",
  "عام أول مسابقة",
  "الأعوام المسجل بها",
  "الحالة",
  "السنة الدراسية وقت الالتحاق",
  "رقم ولي الأمر",
  "رقم الطالب",
  "ملاحظات",
] as const;

/** إرشادات الاستخدام التي تُعرض للمستخدم قبل/بعد الاستيراد. */
export const STUDENT_IMPORT_INSTRUCTIONS: string[] = [
  "لا تُغيّر أسماء الأعمدة في الصف الأول؛ القالب والملف المصدَّر من التطبيق كلاهما صالح للاستيراد.",
  "عمود «اسم الطالب» هو المفتاح: يُطابَق بالاسم بعد تطبيع الهمزات والتاء المربوطة والتشكيل والمسافات الزائدة.",
  "الاسم موجود مسبقاً: تُحدَّث حقوله الفارغة فقط — لا تُمسّ البيانات المُدخلة يدوياً إلا إذا ملأت العمود في الملف.",
  "الاسم غير موجود: يُنشأ طالب جديد في السجل الشامل ويُسجَّل في الأعوام المذكورة.",
  "«الأعوام المسجل بها» مفصولة بفواصل (مثال: 1441، 1445) والأعوام بصيغة أربع خانات، ولذو الحجة تتبع العام لاحقة D (مثال: 1447D).",
  "«الحفظ التراكمي (آخر عام)» يُكتب في آخر عام مسجَّل بالملف، فتظهر قيمته في العمود التراكمي بالجدول.",
  "«رقم القيد» يُهمَل إن وُجد: الترقيم محلي ويُدار تلقائياً داخل التطبيق.",
  "الأعمدة المخصصة المضافة في التطبيق تُستورد بعنوانها نفسه كما في «إدارة الأعمدة».",
  "الملف يُقرأ من الورقة الأولى فقط، والصفوف الفارغة تُتجاهل.",
];

// ===========================================================================
// تطبيع الأعوام
// ===========================================================================

/**
 * يُوحّد رمز العام: "1447" → 1447، "1447D" / "1447 ذ.ح" / "1447هـ · عشر ذي
 * الحجة" → 1447D. يُرجع null إن لم يوجد رقم من أربع خانات.
 */
export function normalizeYearToken(token: unknown): string | null {
  if (token == null) return null;
  const text = String(token).trim();
  if (!text) return null;

  const match = text.match(/(\d{4})/);
  if (!match) return null;

  const digits = match[1];
  const rest = text.replace(digits, "");
  const isDhulHijjah =
    /dhul|du\s*al|عشر|ذ(ي|و)?\s*(ال)?حجة|ذ\.?\s*ح|^\s*D\s*$/i.test(rest) ||
    /^\s*\d{4}\s*D\s*$/i.test(text);
  return isDhulHijjah ? `${digits}D` : digits;
}

/**
 * يحلّل خلية «الأعوام المسجل بها»: تقبل مصفوفة أو نصاً بفواصل عربية/إنجليزية
 * أو أسطر. يوحّد القيم ويزيل المكرر ويحفظ الترتيب (تصاعدياً).
 */
export function parseRegisteredYears(value: unknown): string[] {
  if (value == null) return [];

  const raw: unknown[] = Array.isArray(value)
    ? value
    : String(value)
        .split(/[,،;؛\r\n]+/)
        .map((part) => part.trim())
        .filter(Boolean);

  const years: string[] = [];
  for (const item of raw) {
    const year = normalizeYearToken(item);
    if (year && !years.includes(year)) years.push(year);
  }

  return years.sort(
    (a, b) =>
      parseInt(a, 10) - parseInt(b, 10) || (a.endsWith("D") ? 1 : 0) - (b.endsWith("D") ? 1 : 0),
  );
}

// ===========================================================================
// خريطة الرؤوس → الحقول
// ===========================================================================

type ImportField =
  | "name"
  | "gender"
  | "hijri_join_date"
  | "initial_hifz"
  | "latest_total_hifz"
  | "first_competition_year"
  | "registered_years"
  | "status"
  | "school_grade"
  | "guardian_phone"
  | "student_phone"
  | "notes";

/** أسماء بديلة لكل حقل: عنوان القالب + العناوين القديمة المقبولة. */
const FIELD_ALIASES: Record<ImportField, string[]> = {
  name: ["اسم الطالب", "الاسم", "اسم"],
  gender: ["الجنس"],
  hijri_join_date: ["تاريخ هجري الالتحاق", "تاريخ الالتحاق"],
  initial_hifz: ["الحفظ قبل الالتحاق", "حفظ قبل الالتحاق"],
  latest_total_hifz: ["الحفظ التراكمي (آخر عام)", "الحفظ التراكمي", "آخر حفظ تراكمي"],
  first_competition_year: ["عام أول مسابقة", "عام المسابقة الأولى", "عام أول مسابقة"],
  registered_years: ["الأعوام المسجل بها", "الأعوام المسجلة بها", "الأعوام"],
  status: ["الحالة"],
  school_grade: ["السنة الدراسية وقت الالتحاق", "السنة الدراسية"],
  guardian_phone: ["رقم ولي الأمر", "هاتف ولي الأمر"],
  student_phone: ["رقم الطالب", "هاتف الطالب"],
  notes: ["ملاحظات", "ملاحظة"],
};

const normalizeHeader = (header: string): string =>
  header
    .replace(/[\u064B-\u0652\u0640]/g, "")
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/[()\uFF08\uFF09]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();

const FIELD_BY_HEADER = new Map<string, ImportField>();
for (const [field, aliases] of Object.entries(FIELD_ALIASES)) {
  for (const alias of aliases) FIELD_BY_HEADER.set(normalizeHeader(alias), field as ImportField);
}

/** نوع نتيجة مطابقة الرأس: حقل معروف، أو عمود مخصص، أو غير معروف. */
export type HeaderMatch =
  { kind: "field"; field: ImportField } | { kind: "custom"; id: string } | { kind: "ignored" };

/** يطابق عنوان عمود مع حقول السجل أو الأعمدة المخصصة. */
export function matchColumn(
  header: string | null | undefined,
  customColumns: CustomColumnDef[] = [],
): HeaderMatch {
  const key = normalizeHeader(String(header ?? ""));
  if (!key) return { kind: "ignored" };

  const field = FIELD_BY_HEADER.get(key);
  if (field) return { kind: "field", field };

  const custom = customColumns.find((col) => normalizeHeader(col.name) === key);
  if (custom) return { kind: "custom", id: custom.id };

  return { kind: "ignored" };
}

// ===========================================================================
// تحليل الصفوف
// ===========================================================================

const toText = (value: unknown): string => {
  if (value == null) return "";
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value).trim();
};

const isBlankRow = (row: Record<string, unknown>): boolean =>
  Object.values(row).every((value) => toText(value) === "");

/**
 * يحوّل صفوف Excel إلى سجلات موحّدة.
 * - الصفوف الفارغة تُتجاهل بصمت.
 * - الصف بلا اسم يُسجَّل في `errors` ويُتخطى.
 * - الأسماء المكررة داخل الملف تُدمج في سجل واحد (تعبئة الفراغات فقط).
 */
export function parseStudentRows(
  rows: unknown[],
  customColumns: CustomColumnDef[] = [],
): { rows: ParsedStudentRow[]; errors: string[]; skippedRows: number; mergedRows: number } {
  const parsed: ParsedStudentRow[] = [];
  const errors: string[] = [];
  const byName = new Map<string, ParsedStudentRow>();
  let skippedRows = 0;
  let mergedRows = 0;

  (rows || []).forEach((raw, index) => {
    const rowNumber = index + 2; // +1 لصف الرؤوس و +1 لأن الترقيم يبدأ من 1
    const row = (raw ?? {}) as Record<string, unknown>;
    if (isBlankRow(row)) return;

    const entry: ParsedStudentRow = { name: "", custom_fields: {}, rowNumber };
    const assigned = new Set<ImportField>();

    for (const [header, value] of Object.entries(row)) {
      const match = matchColumn(header, customColumns);
      if (match.kind === "ignored") continue;

      if (match.kind === "custom") {
        const text = toText(value);
        if (text) entry.custom_fields[match.id] = text;
        continue;
      }

      const text = toText(value);
      if (match.field === "registered_years") {
        const years = parseRegisteredYears(value);
        if (years.length) entry.registered_years = years;
        continue;
      }
      if (match.field === "name") {
        entry.name = text;
        assigned.add("name");
        continue;
      }
      if (text) {
        const field = match.field as Exclude<ImportField, "registered_years">;
        entry[field] = text;
        assigned.add(match.field);
      }
    }

    if (!entry.name) {
      skippedRows++;
      if (assigned.size > 0) errors.push(`الصف ${rowNumber}: لا يوجد اسم طالب — تم تخطيه.`);
      else errors.push(`الصف ${rowNumber}: لا يوجد عمود معروف — تأكد من أسماء الأعمدة.`);
      return;
    }

    const key = normalizeStudentName(entry.name);
    const existing = byName.get(key);
    if (existing) {
      // اسم مكرر داخل الملف: أكمل الفراغات فقط ولا تدهس القيم الأولى.
      for (const [field, value] of Object.entries(entry) as [keyof ParsedStudentRow, unknown][]) {
        if (field === "custom_fields") {
          const custom = value as Record<string, string>;
          for (const [id, val] of Object.entries(custom)) {
            if (!existing.custom_fields[id]) existing.custom_fields[id] = val;
          }
        } else if (field === "registered_years") {
          const years = value as string[];
          const union = new Set([...(existing.registered_years || []), ...years]);
          existing.registered_years = Array.from(union);
        } else if (field !== "rowNumber" && field !== "name" && value != null && value !== "") {
          if (!existing[field]) (existing as unknown as Record<string, unknown>)[field] = value;
        }
      }
      existing.mergedFrom = [...(existing.mergedFrom || []), rowNumber];
      mergedRows++;
      return;
    }

    byName.set(key, entry);
    parsed.push(entry);
  });

  return { rows: parsed, errors, skippedRows, mergedRows };
}

// ===========================================================================
// التطبيق على قاعدة البيانات
// ===========================================================================

/** يبني قيم عام واحد مع تحديث الحفظ التراكمي عند الحاجة. */
const buildYearData = (base: YearData, latestTotal?: string): YearData =>
  latestTotal != null && latestTotal !== "" ? { ...base, totalHifz: latestTotal } : { ...base };

/**
 * يطبّق السجلات المحلَّلة على قاعدة البيانات المحلية:
 * - تحديث سجل مطابق بالاسم (حسب تطبيع الأسماء نفسه المستخدم في كشف التكرار).
 * - إنشاء سجل جديد لمن لا مقابل له.
 * - تسجيل الأعوام المذكورة في `year_data` ليظهر الطالب في «الأعوام المسجل بها».
 */
export async function applyStudentImport(
  rows: ParsedStudentRow[],
  parseErrors: string[] = [],
): Promise<StudentImportResult> {
  const existing = await loadGlobalStudentsWithYears();
  const byName = new Map<string, Student>();
  existing.forEach((student) => byName.set(normalizeStudentName(student.name), student));

  let imported = 0;
  let updated = 0;
  let skipped = 0;
  let mergedDuplicates = 0;
  const errors: string[] = [...parseErrors];

  for (const row of rows) {
    try {
      const key = normalizeStudentName(row.name);
      const match = byName.get(key);

      /**
       * يُسجّل الطالب في الأعوام المذكورة بـ year_data (منها يُشتق عمود
       * «الأعوام المسجل بها»)، ويكتب الحفظ التراكمي في آخر عام بالملف.
       */
      const writeYears = async (studentId: number) => {
        const years = row.registered_years || [];
        if (years.length === 0) return;
        const lastYear = years[years.length - 1];
        for (const year of years) {
          const current = await loadYearData(year, studentId);
          const next = buildYearData(
            current,
            year === lastYear ? row.latest_total_hifz : undefined,
          );
          await saveYearData(year, studentId, next);
        }
      };

      if (match) {
        // التحديث: قيم الملف تسبق، وما لم يُذكر في الملف يبقى كما هو.
        const mergedCustom = { ...(match.custom_fields || {}), ...row.custom_fields };
        const savedId = await saveStudent({
          id: match.id,
          name: match.name || row.name,
          gender: row.gender ?? match.gender,
          hijri_join_date: row.hijri_join_date ?? match.hijri_join_date,
          initial_hifz: row.initial_hifz ?? match.initial_hifz,
          first_competition_year: row.first_competition_year ?? match.first_competition_year,
          status: row.status ?? match.status ?? "طبيعي",
          school_grade: row.school_grade ?? match.school_grade,
          guardian_phone: row.guardian_phone ?? match.guardian_phone,
          student_phone: row.student_phone ?? match.student_phone,
          notes: row.notes ?? match.notes,
          custom_fields: mergedCustom,
        });
        if (savedId === null) {
          skipped++;
          continue;
        }
        await writeYears(savedId);
        updated++;
        byName.set(key, { ...match, ...row, id: savedId } as Student);
      } else {
        const savedId = await saveStudent({
          name: row.name,
          gender: row.gender,
          hijri_join_date: row.hijri_join_date,
          initial_hifz: row.initial_hifz,
          first_competition_year: row.first_competition_year,
          status: row.status || "طبيعي",
          school_grade: row.school_grade,
          guardian_phone: row.guardian_phone,
          student_phone: row.student_phone,
          notes: row.notes,
          custom_fields: row.custom_fields,
        });
        if (savedId === null) {
          skipped++;
          continue;
        }
        await writeYears(savedId);
        imported++;
        byName.set(key, { ...row, id: savedId } as unknown as Student);
      }

      mergedDuplicates += row.mergedFrom?.length ?? 0;
    } catch (error) {
      errors.push(
        `الصف ${row.rowNumber} (${row.name}): ${error instanceof Error ? error.message : String(error)}`,
      );
      skipped++;
    }
  }

  return {
    imported,
    updated,
    skipped,
    mergedDuplicates,
    errors,
    total: rows.length + skipped,
  };
}

/** المسار الكامل: صفوف Excel → تحليل → حفظ، مع رسالة عربية موحّدة. */
export async function importStudentsFromRows(
  rows: unknown[],
  customColumns: CustomColumnDef[] = [],
): Promise<StudentImportResult> {
  const { rows: parsed, errors, skippedRows, mergedRows } = parseStudentRows(rows, customColumns);
  const result = await applyStudentImport(parsed, errors);
  return {
    ...result,
    mergedDuplicates: result.mergedDuplicates + mergedRows,
    total: parsed.length + skippedRows,
  };
}

const DEFAULT_TEMPLATE_ROW: Record<string, string | number> = {
  م: 1,
  "رقم القيد": "",
  "اسم الطالب": "مثال: فاطمة أحمد",
  الجنس: "أنثى",
  "تاريخ هجري الالتحاق": "1445/01/01",
  "الحفظ قبل الالتحاق": "5",
  "الحفظ التراكمي (آخر عام)": "18",
  "عام أول مسابقة": "1445",
  "الأعوام المسجل بها": "1441، 1445",
  الحالة: "طبيعي",
  "السنة الدراسية وقت الالتحاق": "الصف التاسع",
  "رقم ولي الأمر": "05xxxxxxxx",
  "رقم الطالب": "",
  ملاحظات: "",
};

/** يبني كائن قالب الاستيراد (رؤوس القالب + صف مثال + الأعمدة المخصصة). */
export function buildStudentImportTemplate(customColumns: CustomColumnDef[] = []): {
  headers: string[];
  rows: Record<string, string | number>[];
} {
  const headers = [...STUDENT_IMPORT_HEADERS, ...customColumns.map((col) => col.name)];
  const row: Record<string, string | number> = {};
  for (const header of headers) row[header] = DEFAULT_TEMPLATE_ROW[header] ?? "";
  return { headers, rows: [row] };
}
/** نص عربي موجز لنتيجة الاستيراد — يُعرض في التنبيه/النافذة. */
export function studentImportSummary(result: StudentImportResult): string {
  const parts: string[] = [];
  if (result.imported) parts.push(`جديد: ${result.imported}`);
  if (result.updated) parts.push(`محدَّث: ${result.updated}`);
  if (result.skipped) parts.push(`متخطى: ${result.skipped}`);
  if (result.mergedDuplicates) parts.push(`أسماء مكررة بالملف دُمجت: ${result.mergedDuplicates}`);
  return parts.length > 0 ? parts.join(" | ") : "لا تغييرات";
}
