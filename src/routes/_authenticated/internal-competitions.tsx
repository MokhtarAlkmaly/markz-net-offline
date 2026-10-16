import { createFileRoute } from "@tanstack/react-router";
import { pageTitle } from "@/lib/center-brand";
import InternalCompetitions from "@/pages/InternalCompetitions";

const title = () => pageTitle("المسابقات الداخلية");
const description = "كشف المسابقات القرآنية الداخلية - قسم القرآن الكريم";

export const Route = createFileRoute("/_authenticated/internal-competitions")({
  head: () => ({
    meta: [
      { title: title() },
      { name: "description", content: description },
      { property: "og:title", content: title() },
      { property: "og:description", content: description },
    ],
  }),
  component: InternalCompetitions,
});
