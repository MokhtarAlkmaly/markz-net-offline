import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { useEffect } from "react";
import { AppSidebar } from "@/components/AppSidebar";
import { CenterSectionTabs } from "@/components/CenterSectionTabs";
import { ViewAsBanner } from "@/components/ViewAsBanner";
import { useSidebarDock } from "@/hooks/useSidebarDock";
import { getSessionUser } from "@/utils/localAuth";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    // الجلسة محلية بالكامل: تُقرأ من التخزين المحلي وقاعدة SQLite على
    // الجهاز دون أي اتصال شبكي.
    const user = await getSessionUser().catch(() => null);
    if (!user) throw redirect({ to: "/auth" });
    return { user };
  },
  component: AuthenticatedLayout,
});

function AuthenticatedLayout() {
  // نقطة التثبيت نفسها التي تقرأها القائمة الجانبية (1280px): عندها فقط
  // نحجز عرض القائمة، وتحتها تعمل درجاً فوق المحتوى فلا يُحجز شيء.
  const sidebarDocked = useSidebarDock();

  // تهيئة قاعدة البيانات المحلية (SQLite/WASM ~1MB) تحدث هنا فقط — أي بعد
  // تسجيل الدخول — بدل تحميلها على كل صفحة من الجذر. صفحة الدخول تهيئها
  // بنفسها عند الحاجة (المصادقة المحلية تحتاجها).
  useEffect(() => {
    (async () => {
      try {
        const { getDB } = await import("@/utils/sqliteClient");
        await getDB();
      } catch (err) {
        console.error("تعذّرت تهيئة قاعدة البيانات المحلية (SQLite)", err);
      }
    })();
  }, []);

  return (
    <div className="min-h-screen" dir="rtl">
      <AppSidebar />
      {/* AppSidebar is fixed only from SIDEBAR_DOCK_BREAKPOINT (1280px) up; below
          that it is a drawer on top of the content, so only the docked state
          reserves its width (w-72 = mr-72). */}
      <main className={`min-h-screen min-w-0 ${sidebarDocked ? "mr-72" : ""}`}>
        {/* يظهر فقط أثناء الاطلاع على بيانات مستخدم آخر (قراءة فقط) */}
        <ViewAsBanner />
        <CenterSectionTabs />
        <Outlet />
      </main>
    </div>
  );
}
