"use client";

import { useTranslations } from "next-intl";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton, Badge } from "@/components/ui/input";
import { PageHeader, EmptyState } from "@/components/common/shared";
import { useRecommendations } from "@/hooks/use-api";
import { PageError } from "@/components/charts/responsive-charts";
import { useChatStore } from "@/stores/chat-store";
import { MessageCircle, Lightbulb, TrendingUp, Wallet, Receipt, CreditCard, ShieldCheck, PiggyBank, Landmark, HandCoins, AlertTriangle, BarChart3 } from "lucide-react";

const TYPE_ICONS: Record<string, typeof Lightbulb> = {
  income: TrendingUp,
  budgeting: Wallet,
  expense_reduction: Receipt,
  debt: CreditCard,
  emergency_fund: ShieldCheck,
  savings: PiggyBank,
  schemes: Landmark,
  non_credit_alternatives: HandCoins,
  responsible_borrowing: AlertTriangle,
  forecast_alert: BarChart3,
  category_forecast: BarChart3,
};

const PRIORITY_STYLES: Record<number, string> = {
  1: "border-l-destructive",
  2: "border-l-warning",
  3: "border-l-primary",
};

export default function RecommendationsPage() {
  const t = useTranslations("recommendations");
  const th = useTranslations("home");
  const tc = useTranslations("common");
  const { data, isLoading, isError, refetch } = useRecommendations();
  const { setOpen, setDraft } = useChatStore();

  const askFinai = (title: string) => {
    setDraft(th("recommendationDraft", { title }));
    setOpen(true);
  };

  const sorted = [...(data?.recommendations ?? [])].sort((a, b) => a.priority - b.priority);

  return (
    <div className="space-y-6">
      <PageHeader title={t("title")} subtitle={t("subtitle")} />

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-24 w-full" />)}
        </div>
      ) : isError ? (
        <PageError message={tc("error")} onRetry={() => refetch()} />
      ) : sorted.length ? (
        <div className="space-y-3">
          {sorted.map((r, i) => {
            const Icon = TYPE_ICONS[r.type] ?? Lightbulb;
            const borderClass = PRIORITY_STYLES[Math.min(r.priority, 3)] ?? "border-l-muted";
            return (
              <Card key={i} className={`border-l-4 ${borderClass}`}>
                <CardHeader className="flex flex-row items-start gap-3 pb-2">
                  <div className="rounded-lg bg-primary/10 p-1.5">
                    <Icon className="h-4 w-4 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <CardTitle className="text-sm font-medium leading-snug">{r.title}</CardTitle>
                  </div>
                  <Badge variant={r.priority === 1 ? "destructive" : r.priority === 2 ? "secondary" : "outline"} className="shrink-0 text-[10px]">
                    P{r.priority}
                  </Badge>
                </CardHeader>
                <CardContent className="pl-12">
                  <p className="text-xs text-text-muted leading-relaxed">{r.reason}</p>
                  <div className="mt-2 flex items-center gap-2">
                    <Badge variant="outline" className="text-[10px]">{r.type.replace(/_/g, " ")}</Badge>
                    <button
                      type="button"
                      onClick={() => askFinai(r.title)}
                      className="inline-flex items-center gap-1 rounded-full border border-primary/30 bg-primary/10 px-2.5 py-0.5 text-[10px] font-medium text-primary transition-colors hover:bg-primary/20"
                    >
                      <MessageCircle className="h-2.5 w-2.5" />
                      {th("askInsight")}
                    </button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        <EmptyState
          title={t("noRecommendations")}
          description={t("noRecommendationsDesc")}
          icon={Lightbulb}
        />
      )}
    </div>
  );
}
