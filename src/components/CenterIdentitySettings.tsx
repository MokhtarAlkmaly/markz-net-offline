import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useCenterBrand } from "@/hooks/useCenterBrand";
import { BRAND_NAME, BRAND_NAME_TAGGED, BRAND_LOCAL_NOTE, BRAND_SUPERVISOR } from "@/lib/brand";
import {
  DEFAULT_CENTER_IDENTITY,
  centerPrintTitle,
  dataUrlSizeLabel,
  normalizeCenterIdentity,
  processLogoFile,
  type CenterIdentity,
} from "@/lib/center-brand";
import { Building2, ImageUp, Loader2, RotateCcw, Save, Trash2, Upload } from "lucide-react";

const getErrorMessage = (error: unknown) => {
  const message = (error as { message?: unknown } | null)?.message;
  return typeof message === "string" ? message : "";
};

/**
 * بطاقة «هوية المركز» في الإعدادات:
 * الاسم الظاهر + سطر الإشراف + الشعار، وتُخزَّن محلياً في قاعدة بيانات الجهاز
 * لصاحب الحساب، ثم تظهر في ترويسات الصفحات وكشوف الطباعة وصفحة الدخول —
 * وبذلك يستخدم التطبيق نفسه أكثر من مركز باسمه وشعاره.
 */
export const CenterIdentitySettings = ({ readOnly = false }: { readOnly?: boolean }) => {
  const { toast } = useToast();
  const centerBrand = useCenterBrand();
  const [draft, setDraft] = useState<CenterIdentity>(centerBrand.identity);
  const [saving, setSaving] = useState(false);
  const [processingLogo, setProcessingLogo] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setDraft(centerBrand.identity);
  }, [centerBrand.identity]);

  const dirty = useMemo(
    () =>
      JSON.stringify(normalizeCenterIdentity(draft)) !==
      JSON.stringify(normalizeCenterIdentity(centerBrand.identity)),
    [centerBrand.identity, draft],
  );

  const previewLogo = draft.logo || centerBrand.logoUrl;
  const previewName = draft.name.trim() || BRAND_NAME;
  const previewSupervisor = draft.supervisor.trim() || BRAND_SUPERVISOR;

  const handleLogoPick = useCallback(
    async (file: File | null | undefined) => {
      if (!file || readOnly) return;
      setProcessingLogo(true);
      try {
        const dataUrl = await processLogoFile(file);
        setDraft((previous) => ({ ...previous, logo: dataUrl }));
        toast({
          title: "تم تجهيز الشعار",
          description: "اضغط «حفظ هوية المركز» لاعتماده في كل الصفحات والكشوف.",
        });
      } catch (error: unknown) {
        toast({
          title: "تعذّر استخدام الصورة",
          description: getErrorMessage(error) || "جرّب صورة PNG أو JPG بحجم أصغر.",
          variant: "destructive",
        });
      } finally {
        setProcessingLogo(false);
        if (inputRef.current) inputRef.current.value = "";
      }
    },
    [readOnly, toast],
  );

  const saveIdentity = async () => {
    if (readOnly) return;
    const next = normalizeCenterIdentity(draft);
    setSaving(true);
    try {
      await centerBrand.save(next);
      setDraft(next);
      toast({
        title: "تم حفظ هوية المركز",
        description: `سيظهر «${next.name}» في الترويسات وصفحة الدخول وكشوف الطباعة.`,
      });
    } catch (error: unknown) {
      toast({
        title: "تعذّر حفظ هوية المركز",
        description: getErrorMessage(error) || "حاول مرة أخرى.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const resetIdentity = async () => {
    if (readOnly) return;
    setSaving(true);
    try {
      await centerBrand.reset();
      setDraft(DEFAULT_CENTER_IDENTITY);
      toast({
        title: "تمت استعادة الهوية الافتراضية",
        description: "عاد الاسم والشعار إلى هوية النسخة الأصلية.",
      });
    } catch (error: unknown) {
      toast({
        title: "تعذّرت الاستعادة",
        description: getErrorMessage(error) || "حاول مرة أخرى.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const busy = saving || processingLogo || centerBrand.saving;

  return (
    <Card className="rounded-[1.75rem] border-emerald-200/70 bg-card/90 shadow-xl shadow-primary/5">
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center gap-2 text-lg">
          <Building2 className="h-5 w-5 text-primary" /> هوية المركز (الاسم والشعار)
          {centerBrand.isCustomized && (
            <Badge variant="secondary" className="text-[11px]">
              مخصّصة
            </Badge>
          )}
        </CardTitle>
        <CardDescription className="leading-6">
          اكتب اسم مركزك وارفع شعاره، وسيُستخدمان في ترويسات الصفحات وكشوف الطباعة وصفحة الدخول —
          بهذا يمكن استخدام التطبيق نفسه لأكثر من مركز، ولكل حساب هويته الخاصة. تُحفظ الهوية على هذا
          الجهاز فقط.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-5 lg:grid-cols-[1.05fr_0.95fr]">
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="center-name">اسم المركز</Label>
            <Input
              id="center-name"
              value={draft.name}
              onChange={(event) =>
                setDraft((previous) => ({ ...previous, name: event.target.value }))
              }
              placeholder="مثال: مركز النور لتحفيظ القرآن الكريم"
              maxLength={120}
              disabled={readOnly}
              className="h-11 rounded-2xl"
            />
            <p className="text-[11px] text-muted-foreground">
              اتركه فارغاً أو استخدم «استعادة الافتراضي» للعودة إلى «{BRAND_NAME}».
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="center-supervisor">سطر الإشراف / الفرع</Label>
            <Input
              id="center-supervisor"
              value={draft.supervisor}
              onChange={(event) =>
                setDraft((previous) => ({ ...previous, supervisor: event.target.value }))
              }
              placeholder={BRAND_SUPERVISOR}
              maxLength={120}
              disabled={readOnly}
              className="h-11 rounded-2xl"
            />
            <p className="text-[11px] text-muted-foreground">
              يظهر أسفل اسم المركز في الترويسة الرسمية وكشوف الطباعة.
            </p>
          </div>

          <div className="space-y-2">
            <Label>شعار المركز</Label>
            <div
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => {
                event.preventDefault();
                if (!readOnly) void handleLogoPick(event.dataTransfer?.files?.[0]);
              }}
              className="flex flex-wrap items-center gap-3 rounded-2xl border border-dashed border-primary/30 bg-primary/[0.04] p-3"
            >
              <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl bg-white p-1.5 ring-1 ring-primary/15">
                {processingLogo ? (
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                ) : (
                  <img
                    src={previewLogo}
                    alt="شعار المركز"
                    className="max-h-full max-w-full object-contain"
                  />
                )}
              </div>
              <div className="min-w-0 flex-1 space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    ref={inputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/svg+xml,image/gif"
                    className="hidden"
                    onChange={(event) => void handleLogoPick(event.target.files?.[0])}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => inputRef.current?.click()}
                    disabled={busy || readOnly}
                    className="gap-2 rounded-2xl"
                  >
                    <Upload className="h-4 w-4" /> اختيار شعار
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => setDraft((previous) => ({ ...previous, logo: null }))}
                    disabled={busy || readOnly || !draft.logo}
                    className="gap-2 rounded-2xl text-destructive hover:bg-destructive/10 hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" /> حذف الشعار
                  </Button>
                </div>
                <p className="text-[11px] leading-5 text-muted-foreground">
                  {draft.logo
                    ? `الشعار الحالي مخصص (${dataUrlSizeLabel(draft.logo)}) — سيُصغَّر تلقائياً للطباعة.`
                    : `يُستخدم حالياً الشعار الافتراضي للتطبيق. مسموح: PNG أو JPG أو SVG (حتى 8 م.ب).`}
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              onClick={() => void saveIdentity()}
              disabled={busy || readOnly || !dirty}
              className="flex-1 gap-2 rounded-2xl sm:flex-none"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {saving ? "جارٍ الحفظ..." : "حفظ هوية المركز"}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => void resetIdentity()}
              disabled={busy || readOnly}
              className="gap-2 rounded-2xl"
            >
              <RotateCcw className="h-4 w-4" /> استعادة الافتراضي
            </Button>
          </div>

          {dirty && (
            <p className="text-[11px] font-semibold text-amber-700 dark:text-amber-300">
              {readOnly
                ? "أنت في وضع الاطلاع — لا يمكن تعديل هوية مركز صاحب البيانات."
                : "لديك تغييرات غير محفوظة على هوية المركز."}
            </p>
          )}
        </div>

        <div className="space-y-3">
          <div className="text-xs font-bold text-muted-foreground">معاينة الهوية</div>

          <div className="rounded-[1.5rem] bg-gradient-to-br from-primary via-emerald-700 to-teal-950 p-4 text-primary-foreground shadow-lg">
            <div className="flex items-center gap-3">
              <div className="rounded-2xl bg-white/95 p-1.5 ring-1 ring-white/40">
                <img src={previewLogo} alt="معاينة الشعار" className="h-14 w-14 object-contain" />
              </div>
              <div className="min-w-0">
                <div className="truncate text-base font-black">{previewName}</div>
                <div className="truncate text-[11px] opacity-85">{BRAND_NAME_TAGGED}</div>
                <div className="truncate text-[11px] opacity-85">{previewSupervisor}</div>
              </div>
            </div>
            <div className="mt-3 flex items-center gap-1.5 border-t border-white/15 pt-2 text-[11px] opacity-90">
              <ImageUp className="h-3.5 w-3.5" />
              <span className="truncate">{BRAND_LOCAL_NOTE}</span>
            </div>
          </div>

          <div className="rounded-2xl border bg-background/70 p-3">
            <div className="text-[11px] text-muted-foreground">ترويسة كشوف الطباعة</div>
            <div className="mt-1 text-sm font-bold">
              {centerPrintTitle({
                name: draft.name.trim() || BRAND_NAME,
                supervisor: draft.supervisor,
                logo: draft.logo,
              })}
            </div>
            <div className="mt-1 text-[11px] text-muted-foreground">
              «{previewName}» هو ما سيظهر في أعلى كل كشف مطبوع بدلاً من اسم النسخة.
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
