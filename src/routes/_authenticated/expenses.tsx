import { createFileRoute } from "@tanstack/react-router";
import { pageTitle } from "@/lib/center-brand";
import Expenses from "@/pages/Expenses";

export const Route = createFileRoute("/_authenticated/expenses")({
  head: () => ({
    meta: [
      { title: pageTitle("مصروفات حفل التكريم") },
      { name: "description", content: "تتبع مصروفات حفل تكريم حافظات القرآن الكريم." },
      {
        property: "og:title",
        content: pageTitle("مصروفات حفل التكريم"),
      },
      { property: "og:description", content: "تتبع مصروفات حفل تكريم حافظات القرآن الكريم." },
    ],
  }),
  component: Expenses,
});
