import { createFileRoute } from "@tanstack/react-router";
import { pageTitle } from "@/lib/center-brand";
import CenterDepartment from "@/pages/CenterDepartment";

export const Route = createFileRoute("/_authenticated/care")({
  head: () => ({
    meta: [{ title: pageTitle("قسم المساعدات والرعاية وكفالة الأيتام") }],
  }),
  component: () => <CenterDepartment department="care" />,
});
