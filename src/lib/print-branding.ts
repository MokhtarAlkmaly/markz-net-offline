/**
 * هوية موحّدة لمستندات الطباعة التي لا تبني ترويسة خاصة بها.
 *
 * بعض التقارير القديمة تحتوي ترويسة مخصّصة بالفعل؛ لذلك لا نكررها إذا وجدنا
 * علامة الهوية أو عنوان المركز النشط. تُستخدم هذه الدالة من مسار الطباعة
 * المشترك حتى تشمل التقارير الجديدة تلقائياً.
 */
import {
  activeCenterLogoSrc,
  activeCenterPrintTitle,
  activeCenterSupervisorLine,
} from "@/lib/center-brand";

const escapeHtml = (value: string) =>
  value.replace(/[&<>"']/g, (character) => {
    const entities: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    };
    return entities[character];
  });

const printHeader = (title: string, supervisor: string, logoSrc: string) => `
  <header class="center-print-brand" data-center-print-brand="active" dir="rtl"
    style="display:flex;align-items:center;justify-content:center;gap:14px;text-align:center;margin:0 0 18px;padding:0 0 12px;border-bottom:3px double #0e6b3a;page-break-inside:avoid">
    <img src="${escapeHtml(logoSrc)}" alt="${escapeHtml(title)}" style="width:64px;height:64px;object-fit:contain;flex:0 0 auto" />
    <div style="min-width:0">
      <div style="color:#0e6b3a;font-size:18px;font-weight:700;line-height:1.5">${escapeHtml(title)}</div>
      <div style="color:#5b6b62;font-size:12px;line-height:1.6">${escapeHtml(supervisor)}</div>
    </div>
  </header>`;

/**
 * يضيف ترويسة الهوية النشطة إلى قالب لا يحتويها.
 * يقرأ الاسم والشعار والإشراف من ذاكرة الهوية الحالية، بما فيها هوية المالك
 * عند تشغيل وضع الاطلاع على مستخدم آخر.
 */
export const withActiveCenterPrintBranding = (html: string, fallbackLogo: string): string => {
  if (!html || html.includes("data-center-print-brand")) return html;

  const title = activeCenterPrintTitle();
  const escapedTitle = escapeHtml(title);
  // توافق مع القوالب القديمة التي بنت ترويسة المركز يدوياً.
  if (html.includes(title) || html.includes(escapedTitle)) return html;

  const header = printHeader(
    title,
    activeCenterSupervisorLine(),
    activeCenterLogoSrc(fallbackLogo),
  );
  const bodyOpen = /<body\b[^>]*>/i.exec(html);
  if (bodyOpen) {
    const insertionPoint = bodyOpen.index + bodyOpen[0].length;
    return `${html.slice(0, insertionPoint)}${header}${html.slice(insertionPoint)}`;
  }

  const closingHtml = html.toLowerCase().lastIndexOf("</html>");
  if (closingHtml >= 0) return `${html.slice(0, closingHtml)}${header}${html.slice(closingHtml)}`;
  return `${header}${html}`;
};
