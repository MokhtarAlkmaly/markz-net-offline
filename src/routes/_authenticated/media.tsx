import { createFileRoute } from "@tanstack/react-router";
import { pageTitle } from "@/lib/center-brand";
import Media from "@/pages/Media";

export const Route = createFileRoute("/_authenticated/media")({
  head: () => ({
    meta: [
      { title: pageTitle("الوسائط والصور") },
      {
        name: "description",
        content: "معرض صور ووسائط المسابقة الرمضانية لنظام Markz Net — نسخة بلا إنترنت.",
      },
      { property: "og:title", content: pageTitle("الوسائط والصور") },
      {
        property: "og:description",
        content: "معرض صور ووسائط المسابقة الرمضانية لنظام Markz Net — نسخة بلا إنترنت.",
      },
    ],
  }),
  component: Media,
});
