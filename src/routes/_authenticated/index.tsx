import { createFileRoute } from "@tanstack/react-router";
import { pageTitle } from "@/lib/center-brand";
import Index from "@/pages/Index";

const title = () => pageTitle("سجل الطلاب الرسمي");
const description =
  "السجل الرسمي لطلاب حلقات القرآن الكريم ونظام إدارة المسابقات | Markz Net — نسخة بلا إنترنت.";

export const Route = createFileRoute("/_authenticated/")({
  head: () => ({
    meta: [
      { title: title() },
      { name: "description", content: description },
      { property: "og:title", content: title() },
      { property: "og:description", content: description },
    ],
  }),
  component: Index,
});
