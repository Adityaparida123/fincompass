"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useSearchParams, useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { motion } from "framer-motion";
import { Compass, KeyRound, ArrowRight, CheckCircle } from "lucide-react";
import { GuestGuard } from "@/components/auth/auth-guard";
import { LoginAnimatedBackground } from "@/components/auth/login-animated-background";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { api } from "@/lib/api";
import { GlassPanel } from "@/components/spatial/glass-panel";

const schema = z.object({
  new_password: z.string().min(8),
  confirm: z.string(),
}).refine((d) => d.new_password === d.confirm, { message: "Passwords don't match", path: ["confirm"] });

export function ResetPasswordClient() {
  const locale = useLocale();
  const t = useTranslations("auth");
  const router = useRouter();
  const params = useSearchParams();
  const token = params.get("token") ?? "";
  const [done, setDone] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm({ resolver: zodResolver(schema) });

  const onSubmit = async (data: z.infer<typeof schema>) => {
    await api.post("/auth/reset-password", { token, new_password: data.new_password }, { skipAuth: true });
    setDone(true);
    setTimeout(() => router.push(`/${locale}/login`), 2000);
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

          <GlassPanel className="page-transition">
            <div className="space-y-6">
              <div className="text-center">
                {done ? (
                  <>
                    <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-emerald-500/15 flex items-center justify-center">
                      <CheckCircle className="h-8 w-8 text-emerald-400" />
                    </div>
                    <h1 className="text-2xl font-bold tracking-tight text-text-primary">{t("passwordResetSuccess")}</h1>
                    <p className="mt-2 text-sm text-text-muted">{t("redirectingToLogin")}</p>
                  </>
                ) : (
                  <>
                    <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-primary/15 flex items-center justify-center border border-primary/30">
                      <KeyRound className="h-8 w-8 text-primary" />
                    </div>
                    <h1 className="text-2xl font-bold tracking-tight text-text-primary">{t("resetPasswordTitle")}</h1>
                    <p className="mt-2 text-sm text-text-muted">{t("resetPasswordSubtitle")}</p>
                  </>
                )}
              </div>

              {!done && (
                <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
                  <div>
                    <Label htmlFor="new_password">{t("newPassword")}</Label>
                    <div className="relative mt-2">
                      <Input 
                        id="new_password" 
                        type={showPassword ? "text" : "password"} 
                        {...register("new_password")} 
                        className="input-premium" 
                        autoComplete="new-password"
                      />
                      <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-foreground transition-colors" onClick={() => setShowPassword(!showPassword)}>
                        {showPassword ? <span className="text-xs">Hide</span> : <span className="text-xs">Show</span>}
                      </button>
                    </div>
                    {errors.new_password && <p className="mt-1.5 text-xs text-destructive">{String(errors.new_password.message)}</p>}
                  </div>
                  <div>
                    <Label htmlFor="confirm">{t("confirmPassword")}</Label>
                    <Input 
                      id="confirm" 
                      type={showPassword ? "text" : "password"} 
                      {...register("confirm")} 
                      className="mt-2 input-premium" 
                      autoComplete="new-password"
                    />
                    {errors.confirm && <p className="mt-1.5 text-xs text-destructive">{String(errors.confirm.message)}</p>}
                  </div>
                  <Button type="submit" className="w-full btn-press" disabled={isSubmitting || !token}>
                    <ArrowRight className="mr-1.5 h-4 w-4" />
                    {t("updatePassword")}
                  </Button>
                </form>
              )}
            </div>
          </GlassPanel>
        </motion.div>
      </div>
    </GuestGuard>
  );
}
