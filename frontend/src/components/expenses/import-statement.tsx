"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { FileUp, UploadCloud, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge, Input, Progress } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useAnalyzeStatement, useImportStatement } from "@/hooks/use-api";
import { ApiRequestError } from "@/lib/api";
import { CATEGORIES } from "@/lib/constants";
import { resolveScope } from "@/lib/expense-scope";
import { formatCurrency, toNumber } from "@/lib/utils";
import { useChatStore } from "@/stores/chat-store";
import type { StatementAnalyzeResponse, StatementPreviewTransaction } from "@/types";

const ACCEPT =
  ".pdf,.xlsx,.xls,.csv,application/pdf,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv";

const STAGES = ["uploading", "reading", "extracting", "categorizing", "duplicates", "ready"];

interface EditableRow extends StatementPreviewTransaction {
  selected: boolean;
}

type Step = "upload" | "analyzing" | "review";

export function ImportStatementDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations("expenses.import");
  const tc = useTranslations("common");
  const analyze = useAnalyzeStatement();
  const confirmImport = useImportStatement();
  const { setOpen: setChatOpen, setDraft: setChatDraft } = useChatStore();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<Step>("upload");
  const [fileName, setFileName] = useState("");
  const [progress, setProgress] = useState(0);
  const [preview, setPreview] = useState<StatementPreviewTransaction[]>([]);
  const [rows, setRows] = useState<EditableRow[]>([]);
  const [summary, setSummary] = useState<StatementAnalyzeResponse | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (step !== "analyzing") return;
    const id = setInterval(() => {
      setProgress((p) => (p >= 92 ? 92 : Math.min(92, p + 6)));
    }, 160);
    return () => clearInterval(id);
  }, [step]);

  const stage = STAGES[Math.min(STAGES.length - 1, Math.floor((progress / 100) * STAGES.length))];

  const handleOpenChange = (next: boolean) => {
    if (next) {
      setStep("upload");
      setFileName("");
      setProgress(0);
      setPreview([]);
      setRows([]);
      setSummary(null);
      setError("");
      analyze.reset();
      confirmImport.reset();
    }
    onOpenChange(next);
  };

  const handleAnalyze = async (file: File) => {
    setError("");
    setFileName(file.name);
    setProgress(0);
    setStep("analyzing");
    try {
      const result = await analyze.mutateAsync(file);
      setPreview(result.transactions);
      setRows(result.transactions.map((tx) => ({ ...tx, selected: !tx.is_duplicate })));
      setSummary(result);
      setProgress(100);
      setStep("review");
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : tc("error"));
      setStep("upload");
    }
  };

  const updateRow = (rowNumber: number, patch: Partial<EditableRow>) => {
    setRows((prev) => prev.map((r) => (r.row_number === rowNumber ? { ...r, ...patch } : r)));
  };

  const handleConfirm = async () => {
    const selected = rows.filter((r) => r.selected);
    if (!selected.length) return;
    setError("");
    try {
      const result = await confirmImport.mutateAsync(
        selected.map((r) => ({
          date: r.date,
          description: r.description,
          amount: r.amount,
          transaction_type: r.transaction_type,
          category: r.category,
          subcategory: r.subcategory,
          merchant: r.merchant,
        })),
      );
      toast.success(t("success", { count: result.imported_count }));
      if (result.duplicates_skipped > 0) {
        toast.info(t("duplicatesSkipped", { count: result.duplicates_skipped }));
      }
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : tc("error"));
    }
  };

  const selectedCount = rows.filter((r) => r.selected).length;
  const duplicateCount = rows.filter((r) => r.is_duplicate).length;
  const needsReviewCount = rows.filter((r) => r.needs_review).length;
  const possibleDuplicateCount = rows.filter((r) => r.duplicate_status === "possible_duplicate").length;
  const recurringCount = rows.filter((r) => r.recurring).length;
  const selectedIncome = rows
    .filter((r) => r.selected && r.transaction_type === "income")
    .reduce((s, r) => s + toNumber(r.amount), 0);
  const selectedExpenses = rows
    .filter((r) => r.selected && r.transaction_type === "expense")
    .reduce((s, r) => s + toNumber(r.amount), 0);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
          <DialogDescription>{t("description")}</DialogDescription>
        </DialogHeader>

        {error && (
          <p className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </p>
        )}

        {step === "upload" && (
          <div className="space-y-4">
            <div
              role="button"
              tabIndex={0}
              className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed p-8 text-center transition-colors hover:bg-accent/50"
              onClick={() => fileInputRef.current?.click()}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") fileInputRef.current?.click();
              }}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                const file = e.dataTransfer.files?.[0];
                if (file) void handleAnalyze(file);
              }}
            >
              <UploadCloud className="h-10 w-10 text-muted-foreground" />
              <p className="text-sm font-medium">{t("dropHint")}</p>
              <p className="text-xs text-muted-foreground">{t("formats")}</p>
              <p className="text-xs text-muted-foreground">{t("privacyNote")}</p>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept={ACCEPT}
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void handleAnalyze(file);
                e.target.value = "";
              }}
            />
            <p className="text-xs text-muted-foreground">{t("scannedWarning")}</p>
          </div>
        )}

        {step === "analyzing" && (
          <div className="space-y-4 py-4">
            <div className="flex items-center gap-2 text-sm">
              <FileUp className="h-4 w-4 animate-pulse text-primary" />
              <span className="truncate">{fileName}</span>
            </div>
            <Progress value={progress} />
            <p className="text-sm text-muted-foreground">{t(stage)}</p>
          </div>
        )}

        {step === "review" && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <Badge variant="secondary">{t("counts", { count: preview.length })}</Badge>
              <Badge variant="outline">
                {t("expenseCount", { count: preview.filter((r) => r.transaction_type === "expense").length })}
              </Badge>
              <Badge variant="success">
                {t("incomeCount", { count: preview.filter((r) => r.transaction_type === "income").length })}
              </Badge>
              {duplicateCount > 0 && (
                <Badge variant="destructive">{t("duplicatesBadge", { count: duplicateCount })}</Badge>
              )}
              {possibleDuplicateCount > 0 && (
                <Badge variant="outline">{t("possibleDuplicatesBadge", { count: possibleDuplicateCount })}</Badge>
              )}
              {recurringCount > 0 && (
                <Badge variant="outline">{t("recurringBadge", { count: recurringCount })}</Badge>
              )}
              {needsReviewCount > 0 && (
                <Badge variant="outline">{t("needsReviewBadge", { count: needsReviewCount })}</Badge>
              )}
            </div>
            {selectedCount > 0 && (
              <p className="text-xs text-muted-foreground">
                {t("detectedAmounts", {
                  count: selectedCount,
                  expenses: formatCurrency(selectedExpenses),
                  income: formatCurrency(selectedIncome),
                })}
              </p>
            )}

            {summary?.start_date && (
              <div className="rounded-xl border bg-surface-card p-4">
                <div className="mb-3 flex items-center justify-between gap-2">
                  <p className="text-xs font-semibold uppercase tracking-[0.06em] text-text-muted">
                    {t("summaryTitle")}
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setChatDraft(
                        t("summaryDraft", {
                          start: summary.start_date ?? "",
                          end: summary.end_date ?? "",
                          income: formatCurrency(toNumber(summary.income_total ?? "0")),
                          expenses: formatCurrency(toNumber(summary.expense_total ?? "0")),
                          net: formatCurrency(toNumber(summary.net_cash_flow ?? "0")),
                        }),
                      );
                      setChatOpen(true);
                      onOpenChange(false);
                    }}
                    className="inline-flex items-center gap-1 text-[11px] font-medium text-primary hover:underline"
                  >
                    <MessageCircle className="h-3 w-3" />
                    {t("summaryAsk")}
                  </button>
                </div>
                <dl className="grid gap-2 sm:grid-cols-3">
                  <div className="rounded-lg border border-border/70 p-3">
                    <dt className="text-[10px] uppercase tracking-[0.06em] text-text-muted">{t("summaryPeriod")}</dt>
                    <dd className="mt-1 text-sm font-medium text-text-primary">
                      {summary.start_date} → {summary.end_date}
                    </dd>
                  </div>
                  <div className="rounded-lg border border-border/70 p-3">
                    <dt className="text-[10px] uppercase tracking-[0.06em] text-text-muted">{t("summaryIncome")}</dt>
                    <dd className="mt-1 text-sm font-semibold text-text-primary">
                      {formatCurrency(toNumber(summary.income_total ?? "0"))}
                    </dd>
                  </div>
                  <div className="rounded-lg border border-border/70 p-3">
                    <dt className="text-[10px] uppercase tracking-[0.06em] text-text-muted">{t("summaryExpenses")}</dt>
                    <dd className="mt-1 text-sm font-semibold text-text-primary">
                      {formatCurrency(toNumber(summary.expense_total ?? "0"))}
                    </dd>
                  </div>
                  <div className="rounded-lg border border-border/70 p-3">
                    <dt className="text-[10px] uppercase tracking-[0.06em] text-text-muted">{t("summaryNet")}</dt>
                    <dd
                      className={`mt-1 text-sm font-semibold ${
                        (summary.net_cash_flow ?? "0").startsWith("-") ? "text-destructive" : "text-emerald-600"
                      }`}
                    >
                      {formatCurrency(toNumber(summary.net_cash_flow ?? "0"))}
                    </dd>
                  </div>
                  <div className="rounded-lg border border-border/70 p-3">
                    <dt className="text-[10px] uppercase tracking-[0.06em] text-text-muted">{t("summaryBusiness")}</dt>
                    <dd className="mt-1 text-sm font-semibold text-text-primary">
                      {formatCurrency(toNumber(summary.business_total ?? "0"))}
                    </dd>
                  </div>
                  <div className="rounded-lg border border-border/70 p-3">
                    <dt className="text-[10px] uppercase tracking-[0.06em] text-text-muted">{t("summaryPersonal")}</dt>
                    <dd className="mt-1 text-sm font-semibold text-text-primary">
                      {formatCurrency(toNumber(summary.personal_total ?? "0"))}
                    </dd>
                  </div>
                </dl>
                <p className="mt-2 text-[10px] text-text-muted/70">{t("summaryScopeNote")}</p>
              </div>
            )}

            <div className="max-h-[45vh] overflow-auto rounded-lg border">
              <table className="w-full text-sm">
                <thead className="sticky top-0 z-10 bg-muted">
                  <tr>
                    <th className="w-10 p-2 text-left font-medium">{t("colSelect")}</th>
                    <th className="p-2 text-left font-medium">{t("colDate")}</th>
                    <th className="p-2 text-left font-medium">{t("colDescription")}</th>
                    <th className="w-36 p-2 text-left font-medium">{t("colMerchant")}</th>
                    <th className="w-28 p-2 text-left font-medium">{t("colAmount")}</th>
                    <th className="w-28 p-2 text-left font-medium">{t("colType")}</th>
                    <th className="w-40 p-2 text-left font-medium">{t("colCategory")}</th>
                    <th className="w-24 p-2 text-left font-medium">{t("colScope")}</th>
                    <th className="w-32 p-2 text-left font-medium">{t("colConfidence")}</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.row_number} className={row.selected ? "border-t" : "border-t opacity-70"}>
                      <td className="p-2 text-center">
                        <input
                          type="checkbox"
                          className="h-4 w-4 accent-primary"
                          checked={row.selected}
                          onChange={(e) => updateRow(row.row_number, { selected: e.target.checked })}
                        />
                      </td>
                      <td className="p-2 whitespace-nowrap">{row.date}</td>
                      <td className="p-2">
                        <Input
                          value={row.description}
                          onChange={(e) => updateRow(row.row_number, { description: e.target.value })}
                          className="h-8 text-sm"
                        />
                      </td>
                      <td className="p-2">
                        {row.merchant ? (
                          <span className="block text-sm">{row.merchant}</span>
                        ) : (
                          <span className="text-sm text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="p-2">
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          value={row.amount}
                          onChange={(e) => updateRow(row.row_number, { amount: e.target.value })}
                          className="h-8 text-sm"
                        />
                      </td>
                      <td className="p-2">
                        <select
                          className="h-8 w-full rounded-lg border border-input bg-background px-2 text-sm"
                          value={row.transaction_type}
                          onChange={(e) =>
                            updateRow(row.row_number, { transaction_type: e.target.value as "income" | "expense" })
                          }
                        >
                          <option value="expense">{t("expense")}</option>
                          <option value="income">{t("income")}</option>
                        </select>
                      </td>
                      <td className="p-2">
                        <select
                          className="h-8 w-full rounded-lg border border-input bg-background px-2 text-sm"
                          value={row.category}
                          onChange={(e) => updateRow(row.row_number, { category: e.target.value })}
                        >
                          {CATEGORIES.map((cat) => (
                            <option key={cat} value={cat}>
                              {cat}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="p-2">
                        {(() => {
                          const scope = resolveScope(row.category, null);
                          return (
                            <Badge variant="outline" className={`text-[10px] capitalize ${scope === "business" ? "border-primary/40 text-primary" : scope === "mixed" ? "border-warning/40 text-warning" : ""}`}>
                              {scope === "mixed" ? t("possiblyMixed") : t(scope)}
                            </Badge>
                          );
                        })()}
                      </td>
                      <td className="p-2">
                        <div className="flex flex-wrap gap-1">
                          {row.is_duplicate && <Badge variant="destructive">{t("duplicate")}</Badge>}
                          {row.duplicate_status === "possible_duplicate" && (
                            <Badge variant="outline">{t("possibleDuplicate")}</Badge>
                          )}
                          {row.recurring && <Badge variant="secondary">{t("recurring")}</Badge>}
                          {row.needs_review && <Badge variant="outline">{t("needsReview")}</Badge>}
                          {!row.needs_review && !row.is_duplicate && (
                            <Badge variant="success">{row.confidence_label}</Badge>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-muted-foreground">{t("selected", { count: selectedCount })}</p>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => onOpenChange(false)}>
                  {tc("cancel")}
                </Button>
                <Button onClick={() => void handleConfirm()} disabled={!selectedCount || confirmImport.isPending}>
                  {confirmImport.isPending ? tc("loading") : t("importSelected", { count: selectedCount })}
                </Button>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
