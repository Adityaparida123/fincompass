"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label, Skeleton } from "@/components/ui/input";
import { PageHeader } from "@/components/common/shared";
import { useAuthStore } from "@/stores/auth-store";
import { api, ApiRequestError } from "@/lib/api";
import type { UserSummary } from "@/types";
import { Check } from "lucide-react";

export default function ProfilePage() {
  const t = useTranslations("profile");
  const tc = useTranslations("common");
  const user = useAuthStore((s) => s.user);
  const [form, setForm] = useState({ full_name: "", email: "", phone: "", preferred_language: "en", currency: "INR", timezone: "Asia/Kolkata" });
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user) {
      setForm({
        full_name: user.full_name,
        email: user.email,
        phone: user.phone ?? "",
        preferred_language: user.preferred_language,
        currency: user.currency,
        timezone: user.timezone,
      });
    }
  }, [user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSaved(false);
    setLoading(true);
    try {
      const updated = await api.patch<UserSummary>("/users/me", {
        full_name: form.full_name,
        email: form.email,
        phone: form.phone || null,
        preferred_language: form.preferred_language,
        currency: form.currency,
        timezone: form.timezone,
      });
      useAuthStore.setState({ user: updated });
      setSaved(true);
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : tc("error"));
    } finally {
      setLoading(false);
    }
  };

  if (!user) return <Skeleton className="h-64 w-full" />;

  return (
    <div className="space-y-6">
      <PageHeader title={t("title")} />

      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-sm font-medium">{t("title")}</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="grid gap-4 sm:grid-cols-2 max-w-2xl">
            <div><Label>{t("fullName")}</Label><Input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} required /></div>
            <div><Label>{t("email")}</Label><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required /></div>
            <div><Label>{t("phone")}</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
            <div><Label>{t("language")}</Label>
              <select className="flex h-10 w-full rounded-lg border border-input bg-background px-3 text-sm" value={form.preferred_language} onChange={(e) => setForm({ ...form, preferred_language: e.target.value })}>
                <option value="en">English</option><option value="hi">हिन्दी</option>
              </select>
            </div>
            <div><Label>{t("currency")}</Label>
              <select className="flex h-10 w-full rounded-lg border border-input bg-background px-3 text-sm" value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })}>
                {["INR", "USD", "EUR", "GBP"].map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div><Label>{t("timezone")}</Label>
              <select className="flex h-10 w-full rounded-lg border border-input bg-background px-3 text-sm" value={form.timezone} onChange={(e) => setForm({ ...form, timezone: e.target.value })}>
                {["Asia/Kolkata", "Asia/Dubai", "UTC"].map((tz) => <option key={tz} value={tz}>{tz}</option>)}
              </select>
            </div>
            <div className="flex items-center gap-3 sm:col-span-2">
              <Button type="submit" disabled={loading}>{tc("save")}</Button>
              {saved && (
                <span className="flex items-center gap-1 text-sm text-income">
                  <Check className="h-4 w-4" />{t("saved")}
                </span>
              )}
            </div>
          </form>
          {error && <p className="mt-2 text-sm text-destructive">{error}</p>}
        </CardContent>
      </Card>
    </div>
  );
}
