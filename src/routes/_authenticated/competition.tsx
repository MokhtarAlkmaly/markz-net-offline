import { createFileRoute } from "@tanstack/react-router";
import { pageTitle } from "@/lib/center-brand";
import Competition from "@/pages/Competition";

const title = () => pageTitle("المسابقة الرمضانية");
const description = "كشوفات المسابقة الرمضانية ومسابقة عشر ذي الحجة - قسم القرآن الكريم";

export const Route = createFileRoute("/_authenticated/competition")({
  head: () => ({
    meta: [
      { title: title() },
      { name: "description", content: description },
      { property: "og:title", content: title() },
      { property: "og:description", content: description },
    ],
  }),
  component: Competition,
});
