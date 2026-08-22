"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { Check, ArrowRight, Shield, Trash2, KeyRound, LogOut, Sparkles, Bell, Palette, Globe2, Lock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, Badge } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PageHeader } from "@/components/common/shared";
import { useAuthStore } from "@/stores/auth-store";
import { useUIStore, type NotificationPref, type Theme, type AIDetail, type AIFocus } from "@/stores/ui-store";
import { useConsents, useGrantConsent, useRevokeConsent } from "@/hooks/use-api";
import { api, ApiRequestError } from "@/lib/api";
import { useTheme } from "@/components/theme-provider";
import type { UserSummary } from "@/types";

const CURRENCIES = ["INR", "USD", "EUR", "GBP"] as const;
const TIMEZONES = ["Asia/Kolkata", "Asia/Dubai", "UTC"] as const;
const CHAT_CONSENT_TYPE = "chat_financial_context";

function SettingsRow({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 py-3">
      <div className="min-w-0">
        <p className="text-sm font-medium text-text-primary">{title}</p>
        {description && <p className="text-xs text-text-muted mt-0.5">{description}</p>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

export default function SettingsPage() {
  const t = useTranslations("settings");
  const tc = useTranslations("common");
  const locale = useLocale();
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const clearAuth = useAuthStore((s) => s.clearAuth);

  const { theme, setTheme } = useTheme();
  const finaiEnabled = useUIStore((s) => s.finaiEnabled);
  const setFinaiEnabled = useUIStore((s) => s.setFinaiEnabled);
  const followUpsEnabled = useUIStore((s) => s.followUpsEnabled);
  const setFollowUpsEnabled = useUIStore((s) => s.setFollowUpsEnabled);
  const aiDetail = useUIStore((s) => s.aiDetail);
  const setAiDetail = useUIStore((s) => s.setAiDetail);
  const aiFocus = useUIStore((s) => s.aiFocus);
  const setAiFocus = useUIStore((s) => s.setAiFocus);
  const budgetAlerts = useUIStore((s) => s.budgetAlerts);
  const expenseReminders = useUIStore((s) => s.expenseReminders);
  const savingsReminders = useUIStore((s) => s.savingsReminders);
  const cashflowAlerts = useUIStore((s) => s.cashflowAlerts);
  const forecastUpdates = useUIStore((s) => s.forecastUpdates);
  const setNotificationPref = useUIStore((s) => s.setNotificationPref);

  const consents = useConsents();
  const grantConsent = useGrantConsent();
  const revokeConsent = useRevokeConsent();

  const [savedField, setSavedField] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const chatConsentItem = consents.data?.items?.find((c) => c.consent_type === CHAT_CONSENT_TYPE);
  const personalizedInsights = chatConsentItem?.status === "granted";

  async function patchProfile(field: "preferred_language" | "currency" | "timezone", value: string) {
    if (!user || user[field] === value) return;
    const prev = user[field];
    setError("");
    setSavedField(null);
    useAuthStore.setState({ user: { ...user, [field]: value } });
    try {
      const updated = await api.patch<UserSummary>("/users/me", { [field]: value });
      useAuthStore.setState({ user: updated });
      setSavedField(field);
    } catch (err) {
      useAuthStore.setState({ user: { ...user, [field]: prev } });
      setError(err instanceof ApiRequestError ? err.message : tc("error"));
    }
  }

  async function togglePersonalizedInsights(on: boolean) {
    setError("");
    try {
      if (on) await grantConsent.mutateAsync(CHAT_CONSENT_TYPE);
      else await revokeConsent.mutateAsync(CHAT_CONSENT_TYPE);
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : tc("error"));
    }
  }

  async function handleDeleteAccount() {
    setDeleting(true);
    setError("");
    try {
      await api.delete("/users/me");
      clearAuth();
      router.push(`/${locale}/login`);
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : tc("error"));
      setDeleting(false);
    }
  }

  async function handleLogout() {
    await logout();
    router.push(`/${locale}/login`);
  }

  if (!user) return null;

  const notificationItems: { key: NotificationPref; label: string; desc: string; value: boolean }[] = [
    { key: "budgetAlerts", label: t("budgetAlerts"), desc: t("budgetAlertsDesc"), value: budgetAlerts },
    { key: "expenseReminders", label: t("expenseReminders"), desc: t("expenseRemindersDesc"), value: expenseReminders },
    { key: "savingsReminders", label: t("savingsReminders"), desc: t("savingsRemindersDesc"), value: savingsReminders },
    { key: "cashflowAlerts", label: t("cashflowAlerts"), desc: t("cashflowAlertsDesc"), value: cashflowAlerts },
    { key: "forecastUpdates", label: t("forecastUpdates"), desc: t("forecastUpdatesDesc"), value: forecastUpdates },
  ];

  return (
    <div className="space-y-6 page-transition">
      <PageHeader title={t("title")} subtitle={t("subtitle")} />

      {/* General */}
      <Card>
        <CardHeader className="pb-2 flex-row items-center gap-2 space-y-0">
          <Globe2 className="h-4 w-4 text-primary" />
          <CardTitle className="text-[11px] font-semibold uppercase tracking-[0.06em] text-text-muted">{t("general")}</CardTitle>
        </CardHeader>
        <CardContent className="pt-1">
          <p className="text-xs text-text-muted mb-2">{t("generalDesc")}</p>
          <div className="grid gap-4 sm:grid-cols-3 max-w-3xl">
            <div>
              <label className="text-xs font-medium text-text-secondary mb-1 block">{t("language")}</label>
              <Select
                value={user.preferred_language}
                onChange={(e) => patchProfile("preferred_language", e.target.value)}
              >
                <option value="en">English</option>
                <option value="hi">हिन्दी</option>
              </Select>
            </div>
            <div>
              <label className="text-xs font-medium text-text-secondary mb-1 block">{t("currency")}</label>
              <Select value={user.currency} onChange={(e) => patchProfile("currency", e.target.value)}>
                {CURRENCIES.map((c) => (
                  <option key={c} value={c}>
                    {c === "INR" ? "INR (₹)" : c === "USD" ? "USD ($)" : c === "EUR" ? "EUR (€)" : "GBP (£)"}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <label className="text-xs font-medium text-text-secondary mb-1 block">{t("timezone")}</label>
              <Select value={user.timezone} onChange={(e) => patchProfile("timezone", e.target.value)}>
                {TIMEZONES.map((tz) => (
                  <option key={tz} value={tz}>{tz}</option>
                ))}
              </Select>
            </div>
          </div>
          <div className="mt-3 h-5 flex items-center gap-3">
            {savedField && (
              <span className="flex items-center gap-1 text-sm text-income">
                <Check className="h-4 w-4" />{t("saved")}
              </span>
            )}
            {error && <span className="text-sm text-destructive">{error}</span>}
          </div>
        </CardContent>
      </Card>

      {/* Appearance */}
      <Card>
        <CardHeader className="pb-2 flex-row items-center gap-2 space-y-0">
          <Palette className="h-4 w-4 text-primary" />
          <CardTitle className="text-[11px] font-semibold uppercase tracking-[0.06em] text-text-muted">{t("appearance")}</CardTitle>
        </CardHeader>
        <CardContent className="pt-1 divide-y divide-border/60">
          <SettingsRow title={t("theme")}>
            <Select
              value={theme}
              onChange={(e) => setTheme(e.target.value as Theme)}
              className="h-9 w-36"
              aria-label={t("theme")}
            >
              <option value="dark">{t("themeDark")}</option>
              <option value="light">{t("themeLight")}</option>
              <option value="system">{t("themeSystem")}</option>
            </Select>
          </SettingsRow>
          <SettingsRow title={t("accent")} description={t("accentValue")}>
            <span className="h-6 w-6 rounded-full bg-primary border border-primary/40 shadow-inner" aria-hidden />
          </SettingsRow>
        </CardContent>
      </Card>

      {/* Notifications */}
      <Card>
        <CardHeader className="pb-2 flex-row items-center gap-2 space-y-0">
          <Bell className="h-4 w-4 text-primary" />
          <CardTitle className="text-[11px] font-semibold uppercase tracking-[0.06em] text-text-muted">{t("notifications")}</CardTitle>
        </CardHeader>
        <CardContent className="pt-1">
          <p className="text-xs text-text-muted mb-1">{t("deviceNote")}</p>
          <div className="divide-y divide-border/60">
            {notificationItems.map((item) => (
              <SettingsRow key={item.key} title={item.label} description={item.desc}>
                <Switch
                  checked={item.value}
                  onCheckedChange={(on) => setNotificationPref(item.key, on)}
                  aria-label={item.label}
                />
              </SettingsRow>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* FinAI */}
      <Card>
        <CardHeader className="pb-2 flex-row items-center gap-2 space-y-0">
          <Sparkles className="h-4 w-4 text-primary" />
          <CardTitle className="text-[11px] font-semibold uppercase tracking-[0.06em] text-text-muted">{t("finai")}</CardTitle>
        </CardHeader>
        <CardContent className="pt-1 divide-y divide-border/60">
          <SettingsRow title={t("enableFinai")} description={t("enableFinaiDesc")}>
            <Switch checked={finaiEnabled} onCheckedChange={setFinaiEnabled} aria-label={t("enableFinai")} />
          </SettingsRow>
          <SettingsRow title={t("followUps")} description={t("followUpsDesc")}>
            <Switch checked={followUpsEnabled} onCheckedChange={setFollowUpsEnabled} aria-label={t("followUps")} />
          </SettingsRow>
          <SettingsRow title={t("aiDetail")} description={t("aiDetailDesc")}>
            <Select
              value={aiDetail}
              onChange={(e) => setAiDetail(e.target.value as AIDetail)}
              className="h-9 w-36"
              aria-label={t("aiDetail")}
            >
              <option value="simple">{t("aiDetailSimple")}</option>
              <option value="detailed">{t("aiDetailDetailed")}</option>
            </Select>
          </SettingsRow>
          <SettingsRow title={t("aiFocus")} description={t("aiFocusDesc")}>
            <Select
              value={aiFocus}
              onChange={(e) => setAiFocus(e.target.value as AIFocus)}
              className="h-9 w-36"
              aria-label={t("aiFocus")}
            >
              <option value="business">{t("aiFocusBusiness")}</option>
              <option value="personal">{t("aiFocusPersonal")}</option>
              <option value="balanced">{t("aiFocusBalanced")}</option>
            </Select>
          </SettingsRow>
          <SettingsRow title={t("personalizedInsights")} description={t("personalizedInsightsDesc")}>
            {consents.isLoading ? (
              <Badge variant="secondary">{t("consentPending")}</Badge>
            ) : (
              <Switch
                checked={personalizedInsights}
                onCheckedChange={togglePersonalizedInsights}
                disabled={grantConsent.isPending || revokeConsent.isPending}
                aria-label={t("personalizedInsights")}
              />
            )}
          </SettingsRow>
        </CardContent>
      </Card>

      {/* Privacy & Data */}
      <Card>
        <CardHeader className="pb-2 flex-row items-center gap-2 space-y-0">
          <Shield className="h-4 w-4 text-primary" />
          <CardTitle className="text-[11px] font-semibold uppercase tracking-[0.06em] text-text-muted">{t("privacy")}</CardTitle>
        </CardHeader>
        <CardContent className="pt-1 space-y-4">
          <Link
            href={`/${locale}/consent`}
            className="flex items-center gap-3 rounded-lg border border-border p-3 hover:bg-surface-container transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
          >
            <Lock className="h-4 w-4 shrink-0 text-primary" />
            <span className="flex-1 min-w-0">
              <span className="block text-sm font-medium text-text-primary">{t("manageConsents")}</span>
              <span className="block text-xs text-text-muted mt-0.5">{t("manageConsentsDesc")}</span>
            </span>
            <ArrowRight className="h-4 w-4 shrink-0 text-text-muted" />
          </Link>

          <div className="rounded-lg border border-border p-3">
            <p className="text-sm font-medium text-text-primary">{t("dataUsage")}</p>
            <p className="text-xs text-text-muted mt-1">{t("dataUsageDesc")}</p>
          </div>

          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0">
              <p className="text-sm font-medium text-text-primary">{t("exportData")}</p>
            </div>
            <Button variant="outline" size="sm" disabled>
              {t("comingSoon")}
            </Button>
          </div>

          <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3">
            <div className="flex items-center justify-between gap-4">
              <div className="min-w-0 flex items-start gap-2">
                <Trash2 className="h-4 w-4 shrink-0 text-destructive mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-destructive">{t("deleteAccount")}</p>
                  <p className="text-xs text-text-muted mt-0.5">{t("deleteAccountDesc")}</p>
                </div>
              </div>
              <Button variant="destructive" size="sm" onClick={() => setDeleteOpen(true)}>
                {t("deleteAccount")}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Security */}
      <Card>
        <CardHeader className="pb-2 flex-row items-center gap-2 space-y-0">
          <KeyRound className="h-4 w-4 text-primary" />
          <CardTitle className="text-[11px] font-semibold uppercase tracking-[0.06em] text-text-muted">{t("security")}</CardTitle>
        </CardHeader>
        <CardContent className="pt-1 divide-y divide-border/60">
          <SettingsRow title={t("changePassword")} description={t("changePasswordDesc")}>
            <Link href={`/${locale}/forgot-password`}>
              <Button variant="outline" size="sm">{t("goToLogin")}</Button>
            </Link>
          </SettingsRow>
          <SettingsRow title={t("logout")} description={t("logoutDesc")}>
            <Button variant="outline" size="sm" onClick={handleLogout}>
              <LogOut className="mr-1.5 h-3.5 w-3.5" />{t("logout")}
            </Button>
          </SettingsRow>
          <SettingsRow title={t("activeSessions")} description={t("activeSessionsUnavailable")}>
            <span />
          </SettingsRow>
        </CardContent>
      </Card>

      {/* Delete account confirmation */}
      <Dialog open={deleteOpen} onOpenChange={(open) => { if (!deleting) setDeleteOpen(open); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t("deleteTitle")}</DialogTitle>
            <DialogDescription>{t("deleteWarning")}</DialogDescription>
          </DialogHeader>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="flex justify-end gap-2 mt-2">
            <Button variant="outline" size="sm" disabled={deleting} onClick={() => setDeleteOpen(false)}>
              {t("deleteCancel")}
            </Button>
            <Button variant="destructive" size="sm" disabled={deleting} onClick={handleDeleteAccount}>
              {deleting ? t("deleting") : t("deleteConfirm")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
