import { createFileRoute } from "@tanstack/react-router";
import { pageTitle } from "@/lib/center-brand";
import OverdueAlerts from "@/pages/OverdueAlerts";

const title = () => pageTitle("المتأخرات والتنبيهات الذكية");
const description =
  "كشف تلقائي بكل ما ينقص: متابعات شهرية غير مسجّلة، إكراميات غير محفوظة، تعهّدات داعمين غير مكتملة، وبيانات مصروفات ناقصة — مع الطباعة والنسخ.";

export const Route = createFileRoute("/_authenticated/alerts")({
  head: () => ({
    meta: [
      { title: title() },
      { name: "description", content: description },
      { property: "og:title", content: title() },
      { property: "og:description", content: description },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: OverdueAlerts,
});
