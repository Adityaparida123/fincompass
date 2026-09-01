"use client";

import { useState } from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { motion } from "framer-motion";
import { Compass, Sparkles, ShieldCheck, Mail, ArrowRight } from "lucide-react";
import { GuestGuard } from "@/components/auth/auth-guard";
import { LoginAnimatedBackground } from "@/components/auth/login-animated-background";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { api } from "@/lib/api";
import { GlassPanel } from "@/components/spatial/glass-panel";
import { SpatialBadge } from "@/components/spatial/spatial-badge";

const schema = z.object({ email: z.string().email() });

export function ForgotPasswordClient() {
  const locale = useLocale();
  const t = useTranslations("auth");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const { register, handleSubmit, formState: { isSubmitting } } = useForm({ resolver: zodResolver(schema) });

  const onSubmit = async (data: z.infer<typeof schema>) => {
    setError("");
    try {
      await api.post("/auth/forgot-password", data, { skipAuth: true });
      setSent(true);
    } catch {
      setSent(true);
    }
  };

  return (
    <GuestGuard>
      <div className="relative flex min-h-screen items-center justify-center p-4 bg-background-page">
        <LoginAnimatedBackground />
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="relative z-10 w-full max-w-md"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.55, delay: 0.12, ease: [0.22, 1, 0.36, 1] }}
            className="mb-8 flex items-center justify-center gap-3"
          >
            <div className="login-logo-glow w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center border border-primary/20">
              <Compass className="h-6 w-6 text-primary" />
            </div>
            <span className="text-2xl font-semibold text-primary tracking-tight">FinCompass</span>
          </motion.div>

          <GlassPanel glow="cyan" hudCorners hologramEdge elevated className="page-transition">
            <div className="space-y-6">
              <div className="text-center">
                <div className="mb-4 flex items-center justify-center gap-2">
                  <SpatialBadge variant="cyan" pulse icon={<Sparkles className="h-3 w-3" />}>
                    {t("telemetryLive")}
                  </SpatialBadge>
                  <SpatialBadge variant="emerald" icon={<ShieldCheck className="h-3 w-3" />}>
                    {t("secureAccess")}
                  </SpatialBadge>
                </div>
                <h1 className="text-2xl font-bold tracking-tight text-text-primary">{t("forgotPasswordTitle")}</h1>
                <p className="mt-2 text-sm text-text-muted">{t("forgotPasswordSubtitle")}</p>
              </div>

              {sent ? (
                <div className="text-center space-y-4">
                  <div className="flex items-center justify-center gap-3 p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30">
                    <div className="w-12 h-12 rounded-full bg-emerald-500/15 flex items-center justify-center">
                      <Mail className="h-6 w-6 text-emerald-400" />
                    </div>
                    <div className="text-left">
                      <p className="text-sm font-semibold text-emerald-300">{t("resetEmailSent")}</p>
                      <p className="mt-1 text-xs text-text-muted">{t("checkInbox")}</p>
                    </div>
                  </div>
                </div>
              ) : (
                <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
                  <div>
                    <Label htmlFor="email">{t("email")}</Label>
                    <Input id="email" type="email" {...register("email")} className="mt-2 input-premium" />
                  </div>
                  <Button type="submit" className="w-full btn-press" disabled={isSubmitting}>
                    <ArrowRight className="mr-1.5 h-4 w-4" />
                    {t("sendResetLink")}
                  </Button>
                  {error && <p className="text-sm text-destructive">{error}</p>}
                </form>
              )}

              <Link href={`/${locale}/login`} className="mt-4 block text-center text-sm text-primary hover:underline flex items-center justify-center gap-1.5">
                <ArrowRight className="h-3.5 w-3.5 -rotate-90" />
                {t("backToLogin")}
              </Link>
            </div>
          </GlassPanel>
        </motion.div>
      </div>
    </GuestGuard>
  );
}
