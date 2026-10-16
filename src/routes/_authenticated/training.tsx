import { createFileRoute } from "@tanstack/react-router";
import { pageTitle } from "@/lib/center-brand";
import CenterDepartment from "@/pages/CenterDepartment";

export const Route = createFileRoute("/_authenticated/training")({
  head: () => ({
    meta: [{ title: pageTitle("قسم التدريب والتأهيل") }],
  }),
  component: () => <CenterDepartment department="training" />,
});
