import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import defaultLogo from "@/assets/logo.png";
import { useAuth } from "@/hooks/useAuth";
import {
  DEFAULT_CENTER_IDENTITY,
  centerHeaderLine,
  centerName,
  normalizeCenterIdentity,
  readDeviceCenterIdentity,
  setActiveCenterIdentity,
  type CenterIdentity,
} from "@/lib/center-brand";
import { BRAND_OFFLINE_TAG } from "@/lib/brand";
import { loadCenterIdentity, saveCenterIdentity, resetCenterIdentity } from "@/utils/storage";

/**
 * مزوّد هوية المركز — يجعل اسم المركز وشعاره يُقرآن من الإعدادات المحلية
 * ويُوزَّعان على كل الصفحات (الواجهة + قوالب الطباعة).
 *
 * الترتيب: عند الدخول تُحمَّل هوية الحساب، وعند الاطلاع على بيانات مستخدم آخر
 * تظهر هوية صاحب البيانات (قراءة فقط، والحفظ ممنوع). وقبل الدخول تُعرض هوية
 * آخر مركز مُعرَّف على الجهاز حتى تبدو صفحة الدخول باسم المركز وشعاره.
 */

interface CenterBrandContextValue {
  /** الهوية الفعلية (اسم + إشراف + شعار). */
  identity: CenterIdentity;
  /** اسم المركز بعد تطبيق البدائل. */
  name: string;
  /** ترويسة الواجهة: «الاسم — نسخة بلا إنترنت · قسم القرآن الكريم». */
  headerLine: string;
  /** شعار العرض: شعار المركز أو الشعار المدمج. */
  logoUrl: string;
  /** هل للمركز شعار مخصص؟ */
  hasCustomLogo: boolean;
  /** هل خصّص المركز اسمه أو شعاره أو سطر إشرافه؟ */
  isCustomized: boolean;
  loading: boolean;
  saving: boolean;
  /** يحدّث هوية المركز النشطة (في قاعدة البيانات المحلية). */
  save: (next: CenterIdentity) => Promise<void>;
  /** يعيد الهوية إلى الافتراضية. */
  reset: () => Promise<void>;
  /** يعيد قراءة الهوية من قاعدة البيانات. */
  refresh: () => Promise<void>;
}

const CenterBrandContext = createContext<CenterBrandContextValue>({
  identity: DEFAULT_CENTER_IDENTITY,
  name: DEFAULT_CENTER_IDENTITY.name,
  headerLine: centerHeaderLine(DEFAULT_CENTER_IDENTITY),
  logoUrl: defaultLogo,
  hasCustomLogo: false,
  isCustomized: false,
  loading: false,
  saving: false,
  save: async () => {},
  reset: async () => {},
  refresh: async () => {},
});

/** يحدّث عنوان التبويب وأيقونته ليطابقا هوية المركز المحفوظة. */
const applyDocumentBranding = (identity: CenterIdentity, logoUrl: string) => {
  if (typeof document === "undefined") return;

  const name = centerName(identity);
  document.title = `${name} ${BRAND_OFFLINE_TAG} — نظام إدارة حلقات ومسابقات القرآن الكريم`;

  // الأيقونة تتبع الشعار الحالي (شعار المركز، أو الشعار المدمج بعد الاستعادة).
  try {
    document
      .querySelectorAll<HTMLLinkElement>('link[rel="icon"], link[rel="apple-touch-icon"]')
      .forEach((link) => {
        link.href = logoUrl;
      });
  } catch {
    /* الأيقونة تحسين شكلي فقط — نتجاهل أي فشل */
  }
};

export const CenterBrandProvider = ({ children }: { children: React.ReactNode }) => {
  const { user, viewAs, loading: authLoading } = useAuth();
  // نبدأ من نسخة الجهاز (localStorage) لتظهر هوية المركز فوراً في صفحة الدخول
  // دون تحميل محرك قاعدة البيانات قبل تسجيل الدخول.
  const [identity, setIdentity] = useState<CenterIdentity>(() => readDeviceCenterIdentity());
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const applyIdentity = useCallback((next: CenterIdentity) => {
    const normalized = normalizeCenterIdentity(next);
    setIdentity(normalized);
    // قوالب الطباعة تُبنى خارج React فتقرأ الهوية النشطة من هذه الذاكرة.
    setActiveCenterIdentity(normalized);
  }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      applyIdentity(await loadCenterIdentity());
    } catch (error) {
      console.warn("تعذّر تحميل هوية المركز:", error);
      applyIdentity(DEFAULT_CENTER_IDENTITY);
    } finally {
      setLoading(false);
    }
  }, [applyIdentity]);

  // تُثبَّت الهوية الأولية في ذاكرة القوالب فوراً (قبل أي قراءة من القاعدة).
  useEffect(() => {
    setActiveCenterIdentity(identity);
    // تُنفَّذ مرة واحدة عند التحميل الأول فقط.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // تُعاد القراءة عند الدخول/الخروج أو تغيير الحساب المعروض في وضع الاطلاع.
  useEffect(() => {
    if (authLoading) return;
    void refresh();
  }, [authLoading, refresh, user?.id, viewAs?.id]);

  const logoUrl = useMemo(() => identity.logo || defaultLogo, [identity.logo]);

  useEffect(() => {
    applyDocumentBranding(identity, logoUrl);
  }, [identity, logoUrl]);

  const save = useCallback(
    async (next: CenterIdentity) => {
      setSaving(true);
      try {
        applyIdentity(await saveCenterIdentity(next));
      } finally {
        setSaving(false);
      }
    },
    [applyIdentity],
  );

  const reset = useCallback(async () => {
    setSaving(true);
    try {
      applyIdentity(await resetCenterIdentity());
    } finally {
      setSaving(false);
    }
  }, [applyIdentity]);

  const value = useMemo<CenterBrandContextValue>(
    () => ({
      identity,
      name: centerName(identity),
      headerLine: centerHeaderLine(identity),
      logoUrl,
      hasCustomLogo: !!identity.logo,
      isCustomized:
        !!identity.logo ||
        centerName(identity) !== DEFAULT_CENTER_IDENTITY.name ||
        identity.supervisor !== DEFAULT_CENTER_IDENTITY.supervisor,
      loading,
      saving,
      save,
      reset,
      refresh,
    }),
    [identity, loading, logoUrl, refresh, reset, save, saving],
  );

  return <CenterBrandContext.Provider value={value}>{children}</CenterBrandContext.Provider>;
};

/** هوية المركز النشطة (للاستخدام داخل مكوّنات React). */
export const useCenterBrand = () => useContext(CenterBrandContext);
