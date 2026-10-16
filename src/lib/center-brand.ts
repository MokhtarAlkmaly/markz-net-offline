/**
 * هوية المركز القابلة للتخصيص — تجعل التطبيق نفسه يخدم أكثر من مركز.
 *
 * لكل حساب في النظام «هوية مركز» خاصة به تُخزَّن محلياً في جدول settings
 * (المفتاح `<userId>:center_identity`):
 *   • الاسم الظاهر للمركز (يظهر في الترويسات والطباعة وصفحة الدخول).
 *   • سطر الإشراف/الفرع (اختياري — وإلا استُخدم الافتراضي من brand.ts).
 *   • الشعار كـ data URL (اختياري — وإلا استُخدم الشعار المدمج في التطبيق).
 *
 * ملاحظتان مهمّتان:
 *   1) الاسم التقني للنسخة `Markz Net — نسخة بلا إنترنت` يبقى في العلامات
 *      الصغيرة (OfflineBadge) لأنه تمييز تقني لا علاقة له باسم المركز.
 *   2) قوالب الطباعة تُبنى داخل معالِجات الأحداث (بدون React)، فتقرأ الهوية من
 *      ذاكرة وحدة صغيرة (`getActiveCenterIdentity`) يُحدّثها مزوّد الهوية عند
 *      تحميلها أو حفظها — لا حاجة لتمرير الاسم والشعار يدوياً في كل تقرير.
 */

import { BRAND_NAME, BRAND_OFFLINE_TAG, BRAND_SECTION, BRAND_SUPERVISOR } from "@/lib/brand";

/** هوية مركز واحدة (اسم + إشراف + شعار). */
export interface CenterIdentity {
  /** اسم المركز/الجهة كما يظهر في الواجهة والطباعة. */
  name: string;
  /** سطر الإشراف أو الفرع. فارغ = الافتراضي. */
  supervisor: string;
  /** شعار المركز كـ data URL، أو null لاستخدام الشعار المدمج. */
  logo: string | null;
}

/** الشعار المدمج في التطبيق يُمرَّر كبديل (fallback) من كل واجهة تستدعي الهوية. */

/** الهوية الافتراضية = هوية النسخة قبل أن يخصّصها المركز. */
export const DEFAULT_CENTER_IDENTITY: CenterIdentity = {
  name: BRAND_NAME,
  supervisor: BRAND_SUPERVISOR,
  logo: null,
};

/** أقصى طول لضلع الصورة المحفوظة كشعار (بكسل) — كافٍ للشاشة والطباعة. */
export const CENTER_LOGO_MAX_SIDE = 640;

/** أقصى حجم مسموح لملف الشعار قبل المعالجة (بالميغابايت). */
export const CENTER_LOGO_MAX_FILE_MB = 8;

/** أقصى حجم للملفات التي لا تُصغَّر (SVG/GIF) كي لا تتضخم قاعدة البيانات. */
export const CENTER_LOGO_VECTOR_MAX_BYTES = 400 * 1024;

/** تطبيع أي قيمة مخزّنة أو مُدخلة إلى هوية صحيحة كاملة. */
export const normalizeCenterIdentity = (
  input: Partial<CenterIdentity> | null | undefined,
): CenterIdentity => {
  const name = typeof input?.name === "string" ? input.name.trim() : "";
  const supervisor = typeof input?.supervisor === "string" ? input.supervisor.trim() : "";
  const logo =
    typeof input?.logo === "string" && input.logo.startsWith("data:image/") ? input.logo : null;

  return {
    name: name || DEFAULT_CENTER_IDENTITY.name,
    supervisor: supervisor || DEFAULT_CENTER_IDENTITY.supervisor,
    logo,
  };
};

/** اسم المركز مع بديل آمن عند الفراغ. */
export const centerName = (identity: CenterIdentity) => identity.name.trim() || BRAND_NAME;

/** سطر الإشراف مع البديل الافتراضي. */
export const centerSupervisor = (identity: CenterIdentity) =>
  identity.supervisor.trim() || BRAND_SUPERVISOR;

/** شعار العرض: شعار المركز إن وُجد، وإلا الشعار المدمج المُمرَّر كبديل. */
export const centerLogo = (identity: CenterIdentity, fallback: string) => identity.logo || fallback;

/** ترويسة الواجهة: «<اسم المركز> — نسخة بلا إنترنت · قسم القرآن الكريم». */
export const centerHeaderLine = (identity: CenterIdentity) =>
  `${centerName(identity)} — ${BRAND_OFFLINE_TAG} · ${BRAND_SECTION}`;

/** ترويسة الطباعة: «<اسم المركز> نسخة بلا إنترنت · قسم القرآن الكريم». */
export const centerPrintTitle = (identity: CenterIdentity) =>
  `${centerName(identity)} ${BRAND_OFFLINE_TAG} · ${BRAND_SECTION}`;

/**
 * عنوان الصفحة (تبويب المتصفح) باسم المركز النشط:
 * «سجل الطلاب | مركز النور — نسخة بلا إنترنت». تُستدعى داخل head() لكل مسار.
 */
export const pageTitle = (page: string) => `${page} | ${activeCenterName()} — ${BRAND_OFFLINE_TAG}`;

/** سطر التوقيع في التذييلات. */
export const centerSignatureLine = (identity: CenterIdentity) =>
  `${centerName(identity)} ${BRAND_OFFLINE_TAG} · تصميم أ/ مختار الكمالي`;

/** هل خصّص صاحب الحساب الهوية (اسم/شعار/إشراف)؟ */
export const hasCustomIdentity = (identity: CenterIdentity) =>
  !!identity.logo ||
  centerName(identity) !== DEFAULT_CENTER_IDENTITY.name ||
  centerSupervisor(identity) !== DEFAULT_CENTER_IDENTITY.supervisor;

// ========== ذاكرة الهوية النشطة (لقوالب الطباعة خارج React) ==========

let activeIdentity: CenterIdentity = DEFAULT_CENTER_IDENTITY;

/** يحدّث الهوية النشطة — يستدعيه مزوّد الهوية فقط. */
export const setActiveCenterIdentity = (identity: CenterIdentity) => {
  activeIdentity = normalizeCenterIdentity(identity);
};

/** الهوية النشطة حالياً (متزامنة — صالحة لقوالب الطباعة). */
export const getActiveCenterIdentity = (): CenterIdentity => activeIdentity;

/** اسم المركز النشط (متزامن). */
export const activeCenterName = () => centerName(activeIdentity);

/** ترويسة الطباعة النشطة (متزامن) — بديل BRAND_PRINT_TITLE. */
export const activeCenterPrintTitle = () => centerPrintTitle(activeIdentity);

/** ترويسة الواجهة النشطة (متزامن) — بديل BRAND_HEADER. */
export const activeCenterHeaderLine = () => centerHeaderLine(activeIdentity);

/** سطر التوقيع النشط (متزامن) — بديل BRAND_SIGNATURE. */
export const activeCenterSignatureLine = () => centerSignatureLine(activeIdentity);

/** سطر الإشراف النشط (متزامن) — بديل BRAND_SUPERVISOR. */
export const activeCenterSupervisorLine = () => centerSupervisor(activeIdentity);

/** شعار الطباعة/العرض النشط (متزامن) — بديل شعار الحزمة. */
export const activeCenterLogoSrc = (fallback: string) => centerLogo(activeIdentity, fallback);

// ========== نسخة الجهاز (لصفحة الدخول قبل تسجيل الدخول) ==========
/**
 * نسخة خفيفة من الهوية تُحفظ في localStorage لتظهر في صفحة الدخول ورسائل
 * الترحيب قبل معرفة صاحب الحساب — بلا أي قراءة من قاعدة البيانات، حتى لا
 * يُحمَّل محرك SQLite/WASM على شاشة الدخول.
 */
export const DEVICE_IDENTITY_STORAGE_KEY = "markznet.centerBrand";

/** يقرأ هوية آخر مركز مُعرَّف على هذا الجهاز (متزامن، بلا قاعدة بيانات). */
export const readDeviceCenterIdentity = (): CenterIdentity => {
  if (typeof window === "undefined") return DEFAULT_CENTER_IDENTITY;
  try {
    const raw = window.localStorage.getItem(DEVICE_IDENTITY_STORAGE_KEY);
    if (!raw) return DEFAULT_CENTER_IDENTITY;
    return normalizeCenterIdentity(JSON.parse(raw) as Partial<CenterIdentity>);
  } catch {
    return DEFAULT_CENTER_IDENTITY;
  }
};

/** يحفظ نسخة الجهاز (تُستدعى مع كل حفظ لهوية المركز). */
export const writeDeviceCenterIdentity = (identity: CenterIdentity) => {
  if (typeof window === "undefined") return;
  try {
    const normalized = normalizeCenterIdentity(identity);
    window.localStorage.setItem(DEVICE_IDENTITY_STORAGE_KEY, JSON.stringify(normalized));
  } catch {
    /* النسخة اختيارية للعرض فقط — تجاهل أي فشل في التخزين */
  }
};

// ========== معالجة ملف الشعار (تصغير + ترميز data URL) ==========

/** يتحقق من ملف شعار مختار ويرجع رسالة خطأ عربية أو null إن كان صالحاً. */
export const validateLogoFile = (file: File): string | null => {
  if (!file.type.startsWith("image/")) {
    return "الملف المختار ليس صورة — استخدم PNG أو JPG أو SVG.";
  }
  if (file.size > CENTER_LOGO_MAX_FILE_MB * 1024 * 1024) {
    return `حجم الصورة كبير (${(file.size / (1024 * 1024)).toFixed(1)} م.ب) — الحد ${CENTER_LOGO_MAX_FILE_MB} م.ب.`;
  }
  if (
    (file.type === "image/svg+xml" || file.type === "image/gif") &&
    file.size > CENTER_LOGO_VECTOR_MAX_BYTES
  ) {
    return "ملفات SVG/GIF الكبيرة غير مدعومة — استخدم صورة PNG أو JPG أصغر.";
  }
  return null;
};

const readFileAsDataUrl = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("تعذّر قراءة ملف الشعار"));
    reader.readAsDataURL(file);
  });

/**
 * يقرأ صورة الشعار ويصغّرها إلى CENTER_LOGO_MAX_SIDE ويحوّلها إلى data URL
 * (WebP إن كان مدعوماً في المتصفح، وإلا PNG). SVG/GIF تُحفظ كما هي لأن
 * تصغيرها قد يفقد الشفافية أو الحركة.
 */
export const processLogoFile = async (file: File): Promise<string> => {
  const error = validateLogoFile(file);
  if (error) throw new Error(error);

  const dataUrl = await readFileAsDataUrl(file);
  const keepAsIs =
    file.type === "image/svg+xml" || file.type === "image/gif" || typeof document === "undefined";
  if (keepAsIs) return dataUrl;

  return new Promise<string>((resolve) => {
    const image = new Image();
    image.onload = () => {
      try {
        const widest = Math.max(
          image.naturalWidth || image.width,
          image.naturalHeight || image.height,
        );
        const scale = widest > CENTER_LOGO_MAX_SIDE ? CENTER_LOGO_MAX_SIDE / widest : 1;
        const width = Math.max(1, Math.round((image.naturalWidth || image.width) * scale));
        const height = Math.max(1, Math.round((image.naturalHeight || image.height) * scale));

        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          resolve(dataUrl);
          return;
        }
        ctx.drawImage(image, 0, 0, width, height);

        const webp = canvas.toDataURL("image/webp", 0.92);
        resolve(webp.startsWith("data:image/webp") ? webp : canvas.toDataURL("image/png"));
      } catch {
        resolve(dataUrl);
      }
    };
    image.onerror = () => resolve(dataUrl);
    image.src = dataUrl;
  });
};

/** حجم تقديري مقروء لنص data URL (للعرض في الواجهة). */
export const dataUrlSizeLabel = (dataUrl: string | null | undefined) => {
  if (!dataUrl) return "";
  const base64 = dataUrl.slice(dataUrl.indexOf(",") + 1);
  const bytes = Math.round((base64.length * 3) / 4);
  if (bytes < 1024) return `${bytes} بايت`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} ك.ب`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} م.ب`;
};
