import { createFileRoute } from "@tanstack/react-router";
import { pageTitle } from "@/lib/center-brand";
import Teachers from "@/pages/Teachers";

export const Route = createFileRoute("/_authenticated/teachers")({
  head: () => ({
    meta: [
      { title: pageTitle("المعلمين والمعلمات والإكراميات") },
      {
        name: "description",
        content: "إدارة المعلمين والمعلمات وإكرامياتهم الشهرية في المسابقة الرمضانية.",
      },
      {
        property: "og:title",
        content: pageTitle("المعلمين والمعلمات والإكراميات"),
      },
      {
        property: "og:description",
        content: "إدارة المعلمين والمعلمات وإكرامياتهم الشهرية في المسابقة الرمضانية.",
      },
    ],
  }),
  component: Teachers,
});
