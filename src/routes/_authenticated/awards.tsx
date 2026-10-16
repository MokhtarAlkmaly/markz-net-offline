import { createFileRoute } from "@tanstack/react-router";
import { pageTitle } from "@/lib/center-brand";
import Awards from "@/pages/Awards";

export const Route = createFileRoute("/_authenticated/awards")({
  head: () => ({
    meta: [
      { title: pageTitle("الجوائز والإكراميات") },
      {
        name: "description",
        content: "متابعة جوائز وإكراميات الطلاب والمعلمين والمعلمات في المسابقة الرمضانية.",
      },
      {
        property: "og:title",
        content: pageTitle("الجوائز والإكراميات"),
      },
      {
        property: "og:description",
        content: "متابعة جوائز وإكراميات الطلاب والمعلمين والمعلمات في المسابقة الرمضانية.",
      },
    ],
  }),
  component: Awards,
});
