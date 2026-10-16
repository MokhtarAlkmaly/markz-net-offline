import { createFileRoute } from "@tanstack/react-router";
import { pageTitle } from "@/lib/center-brand";
import MonthlyTracking from "@/pages/MonthlyTracking";

export const Route = createFileRoute("/_authenticated/monthly")({
  head: () => ({
    meta: [
      { title: pageTitle("المتابعة الشهرية") },
      {
        name: "description",
        content:
          "تسجيل الحفظ الجديد والمواظبة والسلوك شهرياً لكل طالب/ة، وتحديث النتيجة السنوية تلقائياً.",
      },
      { property: "og:title", content: pageTitle("المتابعة الشهرية") },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: MonthlyTracking,
});
