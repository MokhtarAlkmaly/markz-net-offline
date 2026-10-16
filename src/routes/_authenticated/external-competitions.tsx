import { createFileRoute } from "@tanstack/react-router";
import { pageTitle } from "@/lib/center-brand";
import ExternalCompetitions from "@/pages/ExternalCompetitions";

const title = () => pageTitle("المسابقات الخارجية");
const description = "كشف مشاركات المسابقات القرآنية الخارجية - قسم القرآن الكريم";

export const Route = createFileRoute("/_authenticated/external-competitions")({
  head: () => ({
    meta: [
      { title: title() },
      { name: "description", content: description },
      { property: "og:title", content: title() },
      { property: "og:description", content: description },
    ],
  }),
  component: ExternalCompetitions,
});
