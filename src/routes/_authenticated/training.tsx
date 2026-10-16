import { createFileRoute } from "@tanstack/react-router";
import CenterDepartment from "@/pages/CenterDepartment";

export const Route = createFileRoute("/_authenticated/training")({
  head: () => ({
    meta: [{ title: "قسم التدريب والتأهيل | Markz Net — نسخة بلا إنترنت" }],
  }),
  component: () => <CenterDepartment department="training" />,
});
