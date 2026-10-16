import { createFileRoute } from "@tanstack/react-router";
import { pageTitle } from "@/lib/center-brand";
import Khatimat from "@/pages/Khatimat";

export const Route = createFileRoute("/_authenticated/khatimat")({
  head: () => ({
    meta: [
      { title: pageTitle("كشف الخاتمين والخاتمات") },
      {
        name: "description",
        content: "قائمة الطلاب الذين ختمن القرآن الكريم عبر جميع الأعوام.",
      },
      {
        property: "og:title",
        content: pageTitle("كشف الخاتمين والخاتمات"),
      },
      {
        property: "og:description",
        content: "قائمة الطلاب الذين ختمن القرآن الكريم عبر جميع الأعوام.",
      },
    ],
  }),
  component: Khatimat,
});
