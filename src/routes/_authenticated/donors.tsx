import { createFileRoute } from "@tanstack/react-router";
import { pageTitle } from "@/lib/center-brand";
import Donors from "@/pages/Donors";

export const Route = createFileRoute("/_authenticated/donors")({
  head: () => ({
    meta: [
      { title: pageTitle("المتبرعون والدعم") },
      { name: "description", content: "سجل المتبرعين ودعم المسابقة الرمضانية لحفظ القرآن الكريم." },
      { property: "og:title", content: pageTitle("المتبرعون والدعم") },
      {
        property: "og:description",
        content: "سجل المتبرعين ودعم المسابقة الرمضانية لحفظ القرآن الكريم.",
      },
    ],
  }),
  component: Donors,
});
