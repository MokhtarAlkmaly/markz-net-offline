import { useSyncExternalStore } from "react";

/**
 * نقطة التثبيت الوحيدة للقائمة الجانبية (Single source of truth) — 1280px = `xl`.
 *
 * من 1280px وأعلى: القائمة مثبّتة دائماً، وعندها فقط يُحجز عرضها في التخطيط
 * (`mr-72` في `src/routes/_authenticated/route.tsx`).
 * وأدنى من ذلك: تتحوّل إلى **درج** يُفتح بزر عائم صغير، ويُغلق فور اختيار أي
 * صفحة، أو بمفتاح Esc، أو بالنقر على الحاجب، أو بزر الإغلاق داخلها، وتُعطَّل
 * (`inert`) وهي مخفية فلا تحجب المحتوى ولا تلتقط التركيز.
 *
 * السبب في وجود هذا الملف: كان التثبيت مكتوباً في Tailwind داخل القائمة
 * (`md:translate-x-0`) وحجز المساحة في التخطيط منفصلاً عنه (`md:mr-72`)، فبقيت
 * القائمة ظاهرة من 768px بلا أي زر إغلاق (الزر العائم كان `md:hidden`) ولم
 * تختفِ عند اختيار صفحة، فتُغطّي يمين الشاشة على الأجهزة اللوحية والشاشات
 * المتوسطة. الآن رقم واحد يقرأه كل من القائمة والتخطيط، فلا يفترقان مرة أخرى.
 */
export const SIDEBAR_DOCK_BREAKPOINT = 1280;

/** الاستعلام المطابق لنقطة التثبيت (يُبنى من الثابت أعلاه — لا رقم مكرر). */
const DOCK_MEDIA_QUERY = `(min-width: ${SIDEBAR_DOCK_BREAKPOINT}px)`;

/** القراءة المتزامنة للحالة (بدون state ولا إعادة رسم زائدة). */
const readDocked = () =>
  typeof window !== "undefined" && typeof window.matchMedia === "function"
    ? window.matchMedia(DOCK_MEDIA_QUERY).matches
    : false;

/** الاشتراك في تغيّر عرض النافذة (تصغير/تكبير أو تدوير الجهاز). */
const subscribeToDock = (onStoreChange: () => void) => {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return () => {};
  }
  const query = window.matchMedia(DOCK_MEDIA_QUERY);
  query.addEventListener("change", onStoreChange);
  return () => query.removeEventListener("change", onStoreChange);
};

/**
 * على الخادم (قبل أول قياس في المتصفح) نفترض «غير مثبّتة»: الدرج المخفي أأمن
 * من قائمة مثبّتة بلا حجز مساحة، ولا يسبب اختلافاً في التهيئة (hydration).
 */
const readDockedOnServer = () => false;

/**
 * هل القائمة الجانبية مثبّتة الآن (عرض الشاشة ≥ SIDEBAR_DOCK_BREAKPOINT)؟
 * المصدر الوحيد للحقيقة في AppSidebar والتخطيط المُصدَّق.
 */
export function useSidebarDock(): boolean {
  return useSyncExternalStore(subscribeToDock, readDocked, readDockedOnServer);
}
