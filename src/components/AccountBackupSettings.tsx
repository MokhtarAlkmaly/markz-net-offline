import { useRef, useState, type ChangeEvent } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useCenterBrand } from "@/hooks/useCenterBrand";
import { writeDeviceCenterIdentity } from "@/lib/center-brand";
import { loadCenterIdentity } from "@/utils/storage";
import { Download, FileJson, ShieldCheck, Upload } from "lucide-react";
import {
  createAccountBackup,
  parseAccountBackupText,
  previewAccountBackup,
  restoreAccountBackup,
  type AccountBackup,
  type AccountBackupPreview,
  type TableRestorePreview,
} from "@/utils/accountBackup";

interface AccountBackupSettingsProps {
  readOnly: boolean;
}

const TABLE_LABELS: Record<TableRestorePreview["table"], string> = {
  students: "الطلاب",
  hifz_history: "سجل الحفظ",
  year_data: "بيانات الأعوام",
  teachers: "المعلمون والمعلمات",
  teacher_bonuses: "مكافآت المعلمين",
  donors: "الداعمون",
  awards: "الجوائز",
  ceremony_expenses: "مصروفات الحفلات",
  certificates: "الشهادات",
  internal_competitions: "المسابقات الداخلية",
  external_competitions: "المسابقات الخارجية",
  monthly_tracking: "المتابعة الشهرية",
  teacher_portals: "روابط المعلمين",
  monthly_submissions: "الترسيلات الشهرية",
  community_records: "سجل المجتمع",
  exam_questions: "بنك أسئلة الاختبارات",
};

const errorMessage = (error: unknown): string => {
  const message = (error as { message?: unknown } | null)?.message;
  return typeof message === "string" && message ? message : "حدث خطأ غير متوقع. حاول مرة أخرى.";
};

const formatDate = (value: string): string => {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat("ar", { dateStyle: "medium", timeStyle: "short" }).format(date);
};

const PreviewCount = ({ preview }: { preview: AccountBackupPreview }) => {
  const dataTables = preview.tables.filter((table) => table.table !== "students");
  const dataAdded = dataTables.reduce((sum, table) => sum + table.added, 0);
  const dataMatched = dataTables.reduce((sum, table) => sum + table.matched, 0);
  const dataFilled = dataTables.reduce((sum, table) => sum + table.filled, 0);
  const students = preview.tables.find((table) => table.table === "students");

  return (
    <div className="grid gap-2 sm:grid-cols-2">
      <div className="rounded-xl border bg-background/70 p-3 text-sm leading-6">
        <div className="font-bold">الطلاب</div>
        <div>
          جدد: {students?.added ?? 0} · مطابقون بالاسم: {students?.matched ?? 0}
        </div>
        <div>سيُملأ من الفراغات: {students?.filled ?? 0}</div>
      </div>
      <div className="rounded-xl border bg-background/70 p-3 text-sm leading-6">
        <div className="font-bold">بقية السجلات والإعدادات</div>
        <div>سجلات جديدة: {dataAdded + preview.settings.added}</div>
        <div>
          مطابقة: {dataMatched + preview.settings.matched} · فراغات تُملأ:{" "}
          {dataFilled + preview.settings.filled}
        </div>
      </div>
      <div className="rounded-xl border bg-background/70 p-3 text-sm leading-6 sm:col-span-2">
        <div className="font-bold">الوسائط</div>
        <div>
          ملفات جديدة: {preview.media.added} · مكررة ستُدمج دون تكرار: {preview.media.matched} ·
          بيانات تُستكمل: {preview.media.filled}
        </div>
      </div>
    </div>
  );
};

const TablePreviewRow = ({ item }: { item: TableRestorePreview }) => (
  <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 border-b py-2 last:border-0">
    <span className="truncate text-sm font-medium">{TABLE_LABELS[item.table]}</span>
    <span className="text-left text-xs text-muted-foreground" dir="rtl">
      جديد {item.added} · مطابق {item.matched} · فراغات {item.filled}
      {item.skipped > 0 ? ` · متجاوز ${item.skipped}` : ""}
    </span>
  </div>
);

export const AccountBackupSettings = ({ readOnly }: AccountBackupSettingsProps) => {
  const { toast } = useToast();
  const centerBrand = useCenterBrand();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [selectedBackup, setSelectedBackup] = useState<AccountBackup | null>(null);
  const [preview, setPreview] = useState<AccountBackupPreview | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);

  const createBackup = async () => {
    setBusy(true);
    try {
      const backup = await createAccountBackup();
      const contents = JSON.stringify(backup, null, 2);
      const url = URL.createObjectURL(
        new Blob([contents], { type: "application/json;charset=utf-8" }),
      );
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `markznet-backup-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      toast({
        title: "تم إنشاء النسخة الاحتياطية",
        description: "حُفظ ملف JSON محلياً؛ احتفظ به في مكان آمن خارج الجهاز أيضاً.",
      });
    } catch (error) {
      toast({
        title: "تعذّر إنشاء النسخة الاحتياطية",
        description: errorMessage(error),
        variant: "destructive",
      });
    } finally {
      setBusy(false);
    }
  };

  const selectBackupFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";
    if (!file) return;

    setBusy(true);
    try {
      const backup = parseAccountBackupText(await file.text());
      const nextPreview = await previewAccountBackup(backup);
      setSelectedBackup(backup);
      setPreview(nextPreview);
      setPreviewOpen(true);
    } catch (error) {
      toast({
        title: "تعذّرت معاينة النسخة",
        description: errorMessage(error),
        variant: "destructive",
      });
    } finally {
      setBusy(false);
    }
  };

  const restore = async () => {
    if (!selectedBackup || readOnly) return;
    setBusy(true);
    try {
      const result = await restoreAccountBackup(selectedBackup);
      try {
        writeDeviceCenterIdentity(await loadCenterIdentity());
        await centerBrand.refresh();
      } catch {
        // تبقى بيانات الهوية محفوظة في SQLite؛ يعاد تحميلها عند فتح الإعدادات لاحقاً.
      }
      toast({
        title: "تم دمج النسخة الاحتياطية",
        description: `سجلات جديدة: ${result.totalAdded} · مطابقات: ${result.totalMatched} · فراغات مستكملة: ${result.totalFilled}`,
      });
      setPreviewOpen(false);
      setSelectedBackup(null);
      setPreview(null);
    } catch (error) {
      toast({
        title: "تعذّرت استعادة النسخة",
        description: errorMessage(error),
        variant: "destructive",
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Card className="rounded-[1.75rem] border-white/70 bg-card/90 shadow-xl shadow-primary/5">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <FileJson className="h-5 w-5 text-primary" /> النسخ الاحتياطي والاستعادة
          </CardTitle>
          <CardDescription className="leading-6">
            ملف JSON واحد لبيانات الحساب: 16 جدولاً، إعدادات الحساب، وملفات الوسائط. لا يتضمن حسابات
            الدخول أو كلمات المرور، وتتم كل العمليات محلياً دون اتصال.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <Button
              onClick={() => void createBackup()}
              disabled={busy}
              className="h-auto min-h-12 gap-2 rounded-2xl"
            >
              <Download className="h-4 w-4" />
              {busy ? "جارٍ تجهيز الملف..." : "إنشاء نسخة احتياطية"}
            </Button>
            <Button
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
              disabled={busy || readOnly}
              className="h-auto min-h-12 gap-2 rounded-2xl"
            >
              <Upload className="h-4 w-4" /> اختيار ملف للاستعادة
            </Button>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json,application/json"
            onChange={(event) => void selectBackupFile(event)}
            disabled={busy || readOnly}
            className="hidden"
            aria-label="اختيار ملف نسخة احتياطية"
          />
          <div className="flex items-start gap-2 rounded-2xl border border-primary/15 bg-primary/[0.04] p-3 text-xs leading-6 text-muted-foreground">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            <p>
              الاستعادة دمج دائماً ولا تحذف أو تستبدل البيانات الحالية: الطالب المطابق بالاسم بعد
              التطبيع تُستكمل حقوله الفارغة وتُعاد ربط سجلاته، والجداول الأخرى تُطابق بمفاتيحها
              الطبيعية. تظهر معاينة قبل أي كتابة.{" "}
              {readOnly && "الاستعادة معطّلة في وضع الاطلاع للقراءة فقط."}
            </p>
          </div>
        </CardContent>
      </Card>

      <Dialog
        open={previewOpen}
        onOpenChange={(open) => {
          if (!busy) setPreviewOpen(open);
          if (!open && !busy) {
            setSelectedBackup(null);
            setPreview(null);
          }
        }}
      >
        <DialogContent dir="rtl" className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>معاينة دمج النسخة الاحتياطية</DialogTitle>
            <DialogDescription className="leading-6">
              تاريخ الملف: {preview ? formatDate(preview.createdAt) : "—"}. لن تُكتب أي بيانات قبل
              الضغط على «تنفيذ الدمج».
            </DialogDescription>
          </DialogHeader>
          {preview && (
            <div className="space-y-4">
              <div className="rounded-2xl border border-primary/20 bg-primary/[0.04] p-3 text-sm leading-6">
                سيُضاف ما ينقص فقط، وتُملأ الفراغات في السجلات المطابقة. لا يوجد حذف أو استبدال.
              </div>
              <PreviewCount preview={preview} />
              <div className="max-h-64 overflow-y-auto rounded-xl border px-3">
                {preview.tables.map((item) => (
                  <TablePreviewRow key={item.table} item={item} />
                ))}
              </div>
              {preview.totalSkipped > 0 && (
                <p className="rounded-xl border border-amber-300/60 bg-amber-50 p-3 text-sm leading-6 text-amber-900">
                  سيتجاوز الدمج {preview.totalSkipped} صفاً يتعذر ربطها بطالب موجود في ملف النسخة.
                </p>
              )}
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button variant="outline" disabled={busy} onClick={() => setPreviewOpen(false)}>
              إلغاء
            </Button>
            <Button
              disabled={busy || readOnly || !selectedBackup}
              onClick={() => void restore()}
              className="gap-2"
            >
              <Upload className="h-4 w-4" />
              {busy ? "جارٍ الدمج..." : "تنفيذ الدمج"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};
