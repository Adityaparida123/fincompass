"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
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
  ConsentItem,
  Notification,
  RecycleBinItem,
  EMIResult,
  LoanSimulationResult,
  StatementAnalyzeResponse,
  StatementConfirmResponse,
  StatementConfirmItem,
} from "@/types";

export function useExpensesWeekly(year: number, week: number) {
  return useQuery({
    queryKey: ["expenses", "weekly", year, week],
    queryFn: () => api.get<ExpenseSummary>(`/expenses/weekly?year=${year}&week=${week}`),
  });
}

export function useExpensesMonthly(period: string) {
  return useQuery({
    queryKey: ["expenses", "monthly", period],
    queryFn: () => api.get<ExpenseSummary>(`/expenses/monthly?period=${period}`),
  });
}

export function useExpenseCategories(start?: string, end?: string) {
  const params = new URLSearchParams();
  if (start) params.set("start", start);
  if (end) params.set("end", end);
  return useQuery({
    queryKey: ["expenses", "categories", start, end],
    queryFn: () => api.get<CategoryBreakdown[]>(`/expenses/categories?${params}`),
  });
}

export function useExpenseTrends(months = 6) {
  return useQuery({
    queryKey: ["expenses", "trends", months],
    queryFn: () => api.get<ExpenseTrends>(`/expenses/trends?months=${months}`),
  });
}

export function useTransactions(params?: Record<string, string | number>) {
  const qs = params ? "?" + new URLSearchParams(params as Record<string, string>).toString() : "";
  return useQuery({
    queryKey: ["transactions", params],
    queryFn: () => api.get<Page<Transaction>>(`/transactions${qs}`),
  });
}

export function useCreateTransaction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Record<string, unknown>) => api.post<Transaction>("/transactions", body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["transactions"] });
      qc.invalidateQueries({ queryKey: ["expenses"] });
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
        { timeout: 120_000 },
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
    },
  });
}

export function useSavingsGoals() {
  return useQuery({
    queryKey: ["savings", "goals"],
    queryFn: () => api.get<SavingsGoal[]>("/savings/goals"),
  });
}

export function useCreateSavingsGoal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Record<string, unknown>) => api.post<SavingsGoal>("/savings/goals", body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["savings"] }),
  });
}

export function useBudgetStatus(period: string) {
  return useQuery({
    queryKey: ["budget", "status", period],
    queryFn: () => api.get<BudgetStatus[]>(`/budget/status?period=${period}`),
  });
}

export function useBudgets(period?: string) {
  const qs = period ? `?period=${period}` : "";
  return useQuery({
    queryKey: ["budget", period],
    queryFn: () => api.get<BudgetItem[]>(`/budget${qs}`),
  });
}

export function useCreateBudget() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Record<string, unknown>) => api.post<BudgetItem>("/budget", body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["budget"] }),
  });
}

export function useDebts() {
  return useQuery({
    queryKey: ["debt"],
    queryFn: () => api.get<DebtObligation[]>("/debt"),
  });
}

export function useCreateDebt() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Record<string, unknown>) => api.post<DebtObligation>("/debt", body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["debt"] }),
  });
}

export function useReadiness() {
  return useQuery({
    queryKey: ["readiness"],
    queryFn: () => api.get<ReadinessResult>("/credit-readiness"),
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
  return useQuery({
    queryKey: ["recommendations"],
    queryFn: () => api.get<{ recommendations: Recommendation[]; generated_at: string }>("/recommendations"),
  });
}

export function useSchemes() {
  return useQuery({
    queryKey: ["schemes"],
    queryFn: () => api.get<Scheme[]>("/schemes"),
  });
}

export function useConsents() {
  return useQuery({
    queryKey: ["consent"],
    queryFn: () => api.get<{ items: ConsentItem[] }>("/consent"),
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
  return useQuery({
    queryKey: ["notifications", unreadOnly],
    queryFn: () => api.get<{ items: Notification[]; total: number; unread: number }>(
      `/notifications${unreadOnly ? "?unread_only=true" : ""}`,
    ),
  });
}

export function useMarkNotificationRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.patch(`/notifications/${id}/read`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications"] }),
  });
}

export function useRecycleBin() {
  return useQuery({
    queryKey: ["recycle-bin"],
    queryFn: () => api.get<RecycleBinItem[]>("/recycle-bin"),
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
  return useQuery({
    queryKey: ["ml", "forecast"],
    queryFn: () => api.get("/ml/cashflow-forecast"),
  });
}

export function useMLPatterns() {
  return useQuery({
    queryKey: ["ml", "patterns"],
    queryFn: () => api.get("/ml/spending-patterns"),
  });
}

export function useMLSavingsCapacity() {
  return useQuery({
    queryKey: ["ml", "savings-capacity"],
    queryFn: () => api.get("/ml/savings-capacity"),
  });
}
