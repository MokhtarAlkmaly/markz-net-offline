import { createFileRoute } from "@tanstack/react-router";
import { pageTitle } from "@/lib/center-brand";
import Index from "@/pages/Index";

const title = () => pageTitle("الطلاب - السجل الرسمي الشامل");
const description =
  "سجل الطلاب الرسمي الشامل لكل الأعوام في حلقات القرآن الكريم - Markz Net — نسخة بلا إنترنت.";

/**
 * صفحة الطلاب الرئيسية والمستقلة: نفس السجل الشامل لكل الأعوام، لكن على
 * مسار خاص (/students) يظهر كصفحة أساسية في القائمة الجانبية. المسار
 * الرئيسي (/) يعرض نفس الصفحة أيضاً حتى لا يتعطل أي رابط قديم.
 */
export const Route = createFileRoute("/_authenticated/students")({
  head: () => ({
    meta: [
      { title: title() },
      { name: "description", content: description },
      { property: "og:title", content: title() },
      { property: "og:description", content: description },
    ],
  }),
  component: Index,
});
