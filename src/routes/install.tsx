import { createFileRoute } from "@tanstack/react-router";
import { pageTitle } from "@/lib/center-brand";
import Install from "@/pages/Install";

const title = () => pageTitle("تثبيت التطبيق");
const description = "خطوات تثبيت تطبيق المسابقة الرمضانية على الجوال والحاسب.";

export const Route = createFileRoute("/install")({
  head: () => ({
    meta: [
      { title: title() },
      { name: "description", content: description },
      { property: "og:title", content: title() },
      { property: "og:description", content: description },
    ],
  }),
  component: Install,
});
