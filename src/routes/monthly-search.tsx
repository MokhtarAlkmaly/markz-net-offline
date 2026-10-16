import { createFileRoute } from "@tanstack/react-router";
import { pageTitle } from "@/lib/center-brand";
import MonthlyTrackingSearch from "@/pages/MonthlyTrackingSearch";

export const Route = createFileRoute("/monthly-search")({
  head: () => ({
    meta: [
      { title: pageTitle("بحث المتابعة الشهرية") },
      {
        name: "description",
        content:
          "سجل المتابعة الشهرية الكامل للطالب/ة خلال أشهر العام، بمقارنة نسب التقدم بالحفظ والمراجعة، قابل للطباعة والمشاركة.",
      },
      {
        property: "og:title",
        content: pageTitle("بحث المتابعة الشهرية"),
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: MonthlyTrackingSearch,
});
