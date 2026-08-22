"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuthStore } from "@/stores/auth-store";
import type {
  ExpenseSummary,
  CategoryBreakdown,
  ExpenseTrends,
  Page,
  Transaction,
  SavingsGoal,
  BudgetStatus,
  BudgetItem,
  DebtObligation,
  ReadinessResult,
  ScoreCorrectionResult,
  Recommendation,
  Scheme,
  SchemeMatch,
  BusinessProfile,
  ConsentItem,
  Notification,
  RecycleBinItem,
  EMIResult,
  LoanSimulationResult,
  StatementAnalyzeResponse,
  StatementConfirmResponse,
  StatementConfirmItem,
  CashflowForecastResponse,
  SpendingPatternResponse,
  SavingsCapacityResponse,
} from "@/types";

export function useExpensesWeekly(year: number, week: number) {
  const user = useAuthStore((s) => s.user);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  return useQuery({
    queryKey: ["expenses", "weekly", user?.id ?? "anonymous", year, week],
    queryFn: () => api.get<ExpenseSummary>(`/expenses/weekly?year=${year}&week=${week}`),
    enabled: !!user?.id && isAuthenticated,
  });
}

export function useExpensesMonthly(period: string) {
  const user = useAuthStore((s) => s.user);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  return useQuery({
    queryKey: ["expenses", "monthly", user?.id ?? "anonymous", period],
    queryFn: () => api.get<ExpenseSummary>(`/expenses/monthly?period=${period}`),
    enabled: !!user?.id && isAuthenticated,
  });
}

export function useExpenseCategories(start?: string, end?: string) {
  const user = useAuthStore((s) => s.user);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const params = new URLSearchParams();
  if (start) params.set("start", start);
  if (end) params.set("end", end);
  return useQuery({
    queryKey: ["expenses", "categories", user?.id ?? "anonymous", start, end],
    queryFn: () => api.get<CategoryBreakdown[]>(`/expenses/categories?${params}`),
    enabled: !!user?.id && isAuthenticated,
  });
}

export function useExpenseTrends(months = 6) {
  const user = useAuthStore((s) => s.user);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  return useQuery({
    queryKey: ["expenses", "trends", user?.id ?? "anonymous", months],
    queryFn: () => api.get<ExpenseTrends>(`/expenses/trends?months=${months}`),
    enabled: !!user?.id && isAuthenticated,
  });
}

export function useTransactions(params?: Record<string, string | number>) {
  const user = useAuthStore((s) => s.user);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const qs = params ? "?" + new URLSearchParams(params as Record<string, string>).toString() : "";
  return useQuery({
    queryKey: ["transactions", user?.id ?? "anonymous", params],
    queryFn: () => api.get<Page<Transaction>>(`/transactions${qs}`),
    enabled: !!user?.id && isAuthenticated,
  });
}

export function useCreateTransaction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Record<string, unknown>) => api.post<Transaction>("/transactions", body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["transactions"] });
      qc.invalidateQueries({ queryKey: ["expenses"] });
      qc.invalidateQueries({ queryKey: ["cashflow"] });
      qc.invalidateQueries({ queryKey: ["readiness"] });
      qc.invalidateQueries({ queryKey: ["ml"] });
    },
  });
}

export function useDeleteTransaction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.delete(`/transactions/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["transactions"] });
      qc.invalidateQueries({ queryKey: ["expenses"] });
      qc.invalidateQueries({ queryKey: ["cashflow"] });
      qc.invalidateQueries({ queryKey: ["readiness"] });
      qc.invalidateQueries({ queryKey: ["ml"] });
    },
  });
}

export function useAnalyzeStatement() {
  return useMutation({
    mutationFn: (file: File) => {
      const formData = new FormData();
      formData.append("file", file);
      return api.post<StatementAnalyzeResponse>(
        "/transactions/import-statement/analyze",
        formData,
        {
          timeout: 120_000,
          errorMessages: { 404: "Bank statement analysis endpoint is unavailable." },
        },
      );
    },
  });
}

export function useImportStatement() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (transactions: StatementConfirmItem[]) =>
      api.post<StatementConfirmResponse>("/transactions/import-statement/confirm", {
        transactions,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["transactions"] });
      qc.invalidateQueries({ queryKey: ["expenses"] });
      qc.invalidateQueries({ queryKey: ["cashflow"] });
      qc.invalidateQueries({ queryKey: ["readiness"] });
      qc.invalidateQueries({ queryKey: ["ml"] });
    },
  });
}

export function useSavingsGoals() {
  const user = useAuthStore((s) => s.user);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  return useQuery({
    queryKey: ["savings", "goals", user?.id ?? "anonymous"],
    queryFn: () => api.get<SavingsGoal[]>("/savings/goals"),
    enabled: !!user?.id && isAuthenticated,
  });
}

export function useCreateSavingsGoal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Record<string, unknown>) => api.post<SavingsGoal>("/savings/goals", body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["savings"] });
      qc.invalidateQueries({ queryKey: ["readiness"] });
    },
  });
}

export function useBudgetStatus(period: string) {
  const user = useAuthStore((s) => s.user);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  return useQuery({
    queryKey: ["budget", "status", user?.id ?? "anonymous", period],
    queryFn: () => api.get<BudgetStatus[]>(`/budget/status?period=${period}`),
    enabled: !!user?.id && isAuthenticated,
  });
}

export function useBudgets(period?: string) {
  const user = useAuthStore((s) => s.user);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const qs = period ? `?period=${period}` : "";
  return useQuery({
    queryKey: ["budget", user?.id ?? "anonymous", period],
    queryFn: () => api.get<BudgetItem[]>(`/budget${qs}`),
    enabled: !!user?.id && isAuthenticated,
  });
}

export function useCreateBudget() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Record<string, unknown>) => api.post<BudgetItem>("/budget", body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["budget"] });
    },
  });
}

export function useDeleteBudget() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.delete(`/budget/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["budget"] });
    },
  });
}

export function useDebts() {
  const user = useAuthStore((s) => s.user);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  return useQuery({
    queryKey: ["debt", user?.id ?? "anonymous"],
    queryFn: () => api.get<DebtObligation[]>("/debt"),
    enabled: !!user?.id && isAuthenticated,
  });
}

export function useCreateDebt() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Record<string, unknown>) => api.post<DebtObligation>("/debt", body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["debt"] });
      qc.invalidateQueries({ queryKey: ["readiness"] });
    },
  });
}

export function useReadiness() {
  const user = useAuthStore((s) => s.user);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  return useQuery({
    queryKey: ["readiness", user?.id ?? "anonymous"],
    queryFn: () => api.get<ReadinessResult>("/credit-readiness"),
    enabled: !!user?.id && isAuthenticated,
  });
}

export function useCorrectReadiness() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      api.post<ScoreCorrectionResult>("/credit-readiness/correct", body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["readiness"] }),
  });
}

export function useRecommendations() {
  const user = useAuthStore((s) => s.user);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  return useQuery({
    queryKey: ["recommendations", user?.id ?? "anonymous"],
    queryFn: () => api.get<{ recommendations: Recommendation[]; generated_at: string }>("/recommendations"),
    enabled: !!user?.id && isAuthenticated,
  });
}

export function useSchemes() {
  return useQuery({
    queryKey: ["schemes"],
    queryFn: () => api.get<Scheme[]>("/schemes"),
  });
}

export function useRecommendedSchemes(enabled: boolean) {
  const user = useAuthStore((s) => s.user);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  return useQuery({
    queryKey: ["schemes", "recommended", user?.id ?? "anonymous"],
    queryFn: () => api.post<SchemeMatch[]>("/schemes/recommended", {}),
    enabled: enabled && !!user?.id && isAuthenticated,
  });
}

export function useBusinessProfile() {
  const user = useAuthStore((s) => s.user);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  return useQuery({
    queryKey: ["business-profile", user?.id ?? "anonymous"],
    queryFn: () => api.get<BusinessProfile>("/users/me/business"),
    enabled: !!user?.id && isAuthenticated,
  });
}

export function useUpdateBusinessProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      api.patch<BusinessProfile>("/users/me/business", body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["business-profile"] }),
  });
}

export function useConsents() {
  const user = useAuthStore((s) => s.user);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  return useQuery({
    queryKey: ["consent", user?.id ?? "anonymous"],
    queryFn: () => api.get<{ items: ConsentItem[] }>("/consent"),
    enabled: !!user?.id && isAuthenticated,
  });
}

export function useGrantConsent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (consent_type: string) => api.post("/consent", { consent_type }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["consent"] }),
  });
}

export function useRevokeConsent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (consent_type: string) => api.delete(`/consent/${consent_type}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["consent"] }),
  });
}

export function useNotifications(unreadOnly = false) {
  const user = useAuthStore((s) => s.user);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  return useQuery({
    queryKey: ["notifications", user?.id ?? "anonymous", unreadOnly],
    queryFn: () => api.get<{ items: Notification[]; total: number; unread: number }>(
      `/notifications${unreadOnly ? "?unread_only=true" : ""}`,
    ),
    enabled: !!user?.id && isAuthenticated,
  });
}

export function useMarkNotificationRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.patch(`/notifications/${id}/read`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications"] }),
  });
}

export function useMarkAllNotificationsRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.patch("/notifications/read-all"),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications"] }),
  });
}

export function useRecycleBin() {
  const user = useAuthStore((s) => s.user);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  return useQuery({
    queryKey: ["recycle-bin", user?.id ?? "anonymous"],
    queryFn: () => api.get<RecycleBinItem[]>("/recycle-bin"),
    enabled: !!user?.id && isAuthenticated,
  });
}

export function useRestoreRecycleItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.post(`/recycle-bin/${id}/restore`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["recycle-bin"] });
      qc.invalidateQueries({ queryKey: ["transactions"] });
    },
  });
}

export function useCalculateEMI() {
  return useMutation({
    mutationFn: (body: { principal: number; annual_interest_rate: number; tenure_months: number }) =>
      api.post<EMIResult>("/tools/emi", body),
  });
}

export function useLoanSimulation() {
  return useMutation({
    mutationFn: (body: Record<string, number>) =>
      api.post<LoanSimulationResult>("/tools/loan-simulation", body),
  });
}

export function useMLForecast() {
  const user = useAuthStore((s) => s.user);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  return useQuery({
    queryKey: ["ml", "forecast", user?.id ?? "anonymous"],
    queryFn: () => api.get<CashflowForecastResponse>("/ml/cashflow-forecast"),
    enabled: !!user?.id && isAuthenticated,
  });
}

export function useMLPatterns() {
  const user = useAuthStore((s) => s.user);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  return useQuery({
    queryKey: ["ml", "patterns", user?.id ?? "anonymous"],
    queryFn: () => api.get<SpendingPatternResponse>("/ml/spending-patterns"),
    enabled: !!user?.id && isAuthenticated,
  });
}

export function useMLSavingsCapacity() {
  const user = useAuthStore((s) => s.user);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  return useQuery({
    queryKey: ["ml", "savings-capacity", user?.id ?? "anonymous"],
    queryFn: () => api.get<SavingsCapacityResponse>("/ml/savings-capacity"),
    enabled: !!user?.id && isAuthenticated,
  });
}
