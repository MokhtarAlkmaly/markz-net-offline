import { createFileRoute } from "@tanstack/react-router";
import { pageTitle } from "@/lib/center-brand";
import Halaqat from "@/pages/Halaqat";

export const Route = createFileRoute("/_authenticated/halaqat")({
  head: () => ({
    meta: [
      { title: pageTitle("إدارة الحلقات") },
      {
        name: "description",
        content: "إدارة حلقات القرآن وربط الطلاب بالمعلمين والمعلمات حسب العام.",
      },
    ],
  }),
  component: Halaqat,
});
