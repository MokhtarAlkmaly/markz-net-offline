import { createFileRoute } from "@tanstack/react-router";
import { pageTitle } from "@/lib/center-brand";
import Search from "@/pages/Search";

export const Route = createFileRoute("/_authenticated/search")({
  head: () => ({
    meta: [
      { title: pageTitle("بحث عن طالب/ة") },
      {
        name: "description",
        content: "بحث عن الطالب/ة وعرض سجلها الشامل لكل الأعوام مع الطباعة والتصدير والمشاركة.",
      },
      { property: "og:title", content: pageTitle("بحث عن طالب/ة") },
      {
        property: "og:description",
        content: "سجل الطالب/ة الكامل لجميع الأعوام قابل للتعديل والطباعة والتصدير.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Search,
});
