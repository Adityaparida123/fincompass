"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input, Label, Skeleton } from "@/components/ui/input";
import { useAuthStore } from "@/stores/auth-store";
import { api, ApiRequestError } from "@/lib/api";
import type { UserSummary } from "@/types";
import { CheckCircle2, User, Shield, Key } from "lucide-react";
import { CommandHeader } from "@/components/spatial/command-header";
import { GlassPanel } from "@/components/spatial/glass-panel";
import { SpatialBadge } from "@/components/spatial/spatial-badge";

export default function ProfilePage() {
  const t = useTranslations("profile");
  const tc = useTranslations("common");
  const user = useAuthStore((s) => s.user);
  const [form, setForm] = useState({ full_name: "", email: "", phone: "", preferred_language: "en", currency: "INR", timezone: "Asia/Kolkata" });
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const [prevUser, setPrevUser] = useState<UserSummary | null>(user);
  if (user !== prevUser) {
    setPrevUser(user);
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
  }

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

  if (!user) return <Skeleton className="h-64 w-full rounded-2xl" />;

  return (
    <div className="space-y-6 page-transition">
      <CommandHeader
        tag="OPERATOR PROFILE"
        title={t("title")}
        subtitle="Manage credentials, locale preferences, and financial reporting units"
        action={
          <div className="flex items-center gap-2">
            <SpatialBadge variant="cyan" pulse>OPERATOR ID #{user.id?.slice(0, 6)}</SpatialBadge>
          </div>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-8">
          <GlassPanel glow="cyan" hudCorners className="p-6">
            <div className="flex items-center justify-between pb-3 border-b border-white/5 mb-6">
              <h3 className="text-xs font-bold uppercase tracking-wider text-cyan-400 flex items-center gap-2">
                <User className="h-4 w-4 text-cyan-400" />
                <span>Personal Identifier Configuration</span>
              </h3>
              <SpatialBadge variant="cyan">AUTHENTICATED</SpatialBadge>
            </div>

            <form onSubmit={handleSubmit} className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label className="text-xs text-text-secondary">{t("fullName")}</Label>
                <Input className="mt-1 bg-surface-container border-cyan-500/20" value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} required />
              </div>
              <div>
                <Label className="text-xs text-text-secondary">{t("email")}</Label>
                <Input className="mt-1 bg-surface-container border-cyan-500/20 font-mono" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
              </div>
              <div>
                <Label className="text-xs text-text-secondary">{t("phone")}</Label>
                <Input className="mt-1 bg-surface-container border-cyan-500/20 font-mono" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
              </div>
              <div>
                <Label className="text-xs text-text-secondary">{t("language")}</Label>
                <select className="flex h-10 w-full mt-1 rounded-xl border border-cyan-500/20 bg-surface-container px-3 text-xs text-text-primary focus:outline-none focus:ring-1 focus:ring-cyan-400" value={form.preferred_language} onChange={(e) => setForm({ ...form, preferred_language: e.target.value })}>
                  <option value="en">English (Command UI)</option>
                  <option value="hi">हिन्दी (Indian Vernacular)</option>
                </select>
              </div>
              <div>
                <Label className="text-xs text-text-secondary">{t("currency")}</Label>
                <select className="flex h-10 w-full mt-1 rounded-xl border border-cyan-500/20 bg-surface-container px-3 text-xs text-text-primary focus:outline-none focus:ring-1 focus:ring-cyan-400 font-mono" value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })}>
                  {["INR", "USD", "EUR", "GBP"].map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <Label className="text-xs text-text-secondary">{t("timezone")}</Label>
                <select className="flex h-10 w-full mt-1 rounded-xl border border-cyan-500/20 bg-surface-container px-3 text-xs text-text-primary focus:outline-none focus:ring-1 focus:ring-cyan-400 font-mono" value={form.timezone} onChange={(e) => setForm({ ...form, timezone: e.target.value })}>
                  {["Asia/Kolkata", "Asia/Dubai", "UTC"].map((tz) => <option key={tz} value={tz}>{tz}</option>)}
                </select>
              </div>
              <div className="flex items-center gap-3 sm:col-span-2 pt-3">
                <Button type="submit" disabled={loading} className="bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold px-6 shadow-[0_0_15px_rgba(0,242,254,0.3)]">
                  {loading ? "SAVING..." : tc("save")}
                </Button>
                {saved && (
                  <span className="flex items-center gap-1.5 text-xs font-mono font-bold text-emerald-400">
                    <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                    <span>{t("saved")}</span>
                  </span>
                )}
              </div>
            </form>
            {error && <p className="mt-3 text-xs font-mono text-rose-400">{error}</p>}
          </GlassPanel>
        </div>

        <div className="lg:col-span-4 space-y-4">
          <GlassPanel className="p-5 space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-text-secondary">Security Protocol</h4>
            <div className="space-y-2 text-xs font-mono">
              <div className="flex items-center justify-between p-2.5 rounded-xl bg-surface-container border border-white/5">
                <span className="text-text-muted">Multi-factor Auth</span>
                <span className="text-emerald-400 font-semibold">Active (JWT)</span>
              </div>
              <div className="flex items-center justify-between p-2.5 rounded-xl bg-surface-container border border-white/5">
                <span className="text-text-muted">Role</span>
                <span className="text-cyan-300 font-semibold">{user.role ?? "user"}</span>
              </div>
            </div>
          </GlassPanel>
        </div>
      </div>
    </div>
  );
}
