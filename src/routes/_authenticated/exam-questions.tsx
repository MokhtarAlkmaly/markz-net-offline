import { createFileRoute } from "@tanstack/react-router";
import { pageTitle } from "@/lib/center-brand";
import ExamQuestions from "@/pages/ExamQuestions";

export const Route = createFileRoute("/_authenticated/exam-questions")({
  head: () => ({
    meta: [
      { title: pageTitle("أسئلة الاختبارات") },
      { name: "description", content: "بنك أسئلة الاختبارات لإدارة أسئلة الحفظ والتلاوة." },
    ],
  }),
  component: ExamQuestions,
});
