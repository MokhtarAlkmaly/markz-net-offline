import { createFileRoute } from "@tanstack/react-router";
import { pageTitle } from "@/lib/center-brand";
import Certificates from "@/pages/Certificates";

export const Route = createFileRoute("/_authenticated/certificates")({
  head: () => ({
    meta: [
      { title: pageTitle("الشهادات والتكريم") },
      { name: "description", content: "إصدار وطباعة شهادات التكريم للطلاب والمعلمين والمعلمات." },
      { property: "og:title", content: pageTitle("الشهادات والتكريم") },
      {
        property: "og:description",
        content: "إصدار وطباعة شهادات التكريم للطلاب والمعلمين والمعلمات.",
      },
    ],
  }),
  component: Certificates,
});
