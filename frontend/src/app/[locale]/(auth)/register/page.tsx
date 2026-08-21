"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { motion } from "framer-motion";
import { useState } from "react";
import { Compass } from "lucide-react";
import { GuestGuard } from "@/components/auth/auth-guard";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuthStore } from "@/stores/auth-store";
import { ApiRequestError } from "@/lib/api";

const schema = z.object({
  fullName: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(8),
  confirmPassword: z.string(),
  terms: z.literal(true, { errorMap: () => ({ message: "Required" }) }),
}).refine((d) => d.password === d.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

type FormData = z.infer<typeof schema>;

export default function RegisterPage() {
  const t = useTranslations("auth");
  const locale = useLocale();
  const router = useRouter();
  const registerUser = useAuthStore((s) => s.register);
  const [error, setError] = useState("");

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  const onSubmit = async (data: FormData) => {
    setError("");
    try {
      await registerUser(data.fullName, data.email, data.password);
      router.push(`/${locale}/home`);
    } catch (e) {
      if (e instanceof ApiRequestError) {
        setError(e.message);
      } else if (e instanceof Error) {
        setError(e.message);
      } else {
        setError("Registration failed");
      }
    }
  };

  return (
    <GuestGuard>
      <div className="flex min-h-screen items-center justify-center p-4 bg-background-page">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-md">
          <div className="mb-8 flex items-center justify-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center border border-primary/20">
              <Compass className="h-6 w-6 text-primary" />
            </div>
            <span className="text-2xl font-semibold text-primary tracking-tight">FinCompass</span>
          </div>
          <Card>
            <CardHeader><CardTitle className="text-lg">{t("registerTitle")}</CardTitle></CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
                <div>
                  <Label>{t("fullName")}</Label>
                  <Input {...register("fullName")} className="mt-2" />
                  {errors.fullName && <p className="mt-1.5 text-xs text-destructive">{errors.fullName.message}</p>}
                </div>
                <div>
                  <Label>{t("email")}</Label>
                  <Input type="email" {...register("email")} className="mt-2" />
                  {errors.email && <p className="mt-1.5 text-xs text-destructive">{errors.email.message}</p>}
                </div>
                <div>
                  <Label>{t("password")}</Label>
                  <Input type="password" {...register("password")} className="mt-2" />
                  {errors.password && <p className="mt-1.5 text-xs text-destructive">{errors.password.message}</p>}
                </div>
                <div>
                  <Label>{t("confirmPassword")}</Label>
                  <Input type="password" {...register("confirmPassword")} className="mt-2" />
                  {errors.confirmPassword && <p className="mt-1.5 text-xs text-destructive">{errors.confirmPassword.message}</p>}
                </div>
                <label className="flex items-start gap-2 text-sm">
                  <input type="checkbox" {...register("terms")} className="mt-1 rounded border-border-subtle" />
                  {t("termsAgree")}
                </label>
                {error && <p className="text-sm text-destructive">{error}</p>}
                <Button type="submit" className="w-full" disabled={isSubmitting}>{t("registerButton")}</Button>
              </form>
              <p className="mt-6 text-center text-sm text-text-muted">{t("hasAccount")} <Link href={`/${locale}/login`} className="text-primary hover:underline">Login</Link></p>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </GuestGuard>
  );
}
