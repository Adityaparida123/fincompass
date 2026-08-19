"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { motion } from "framer-motion";
import { useState } from "react";
import { Eye, EyeOff, Compass } from "lucide-react";
import { GuestGuard } from "@/components/auth/auth-guard";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuthStore } from "@/stores/auth-store";
import { ApiRequestError } from "@/lib/api";

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  rememberMe: z.boolean().optional(),
});

type FormData = z.infer<typeof schema>;

export default function LoginPage() {
  const t = useTranslations("auth");
  const locale = useLocale();
  const router = useRouter();
  const login = useAuthStore((s) => s.login);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  const onSubmit = async (data: FormData) => {
    setError("");
    try {
      await login(data.email, data.password, data.rememberMe);
      router.push(`/${locale}/dashboard`);
    } catch (e) {
      setError(e instanceof ApiRequestError ? e.message : "Login failed");
    }
  };

  return (
    <GuestGuard>
      <div className="flex min-h-screen items-center justify-center p-4">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-md">
          <div className="mb-8 flex items-center justify-center gap-2">
            <Compass className="h-8 w-8 text-primary" />
            <span className="text-2xl font-semibold">FinCompass</span>
          </div>
          <Card>
            <CardHeader>
              <CardTitle>{t("loginTitle")}</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                <div>
                  <Label htmlFor="email">{t("email")}</Label>
                  <Input id="email" type="email" {...register("email")} className="mt-1" />
                  {errors.email && <p className="mt-1 text-xs text-destructive">{errors.email.message}</p>}
                </div>
                <div>
                  <Label htmlFor="password">{t("password")}</Label>
                  <div className="relative mt-1">
                    <Input id="password" type={showPassword ? "text" : "password"} {...register("password")} />
                    <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2" onClick={() => setShowPassword(!showPassword)}>
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  {errors.password && <p className="mt-1 text-xs text-destructive">{errors.password.message}</p>}
                </div>
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" {...register("rememberMe")} />
                  {t("rememberMe")}
                </label>
                {error && <p className="text-sm text-destructive">{error}</p>}
                <Button type="submit" className="w-full" disabled={isSubmitting}>
                  {t("loginButton")}
                </Button>
              </form>
              <div className="mt-4 flex flex-col gap-2 text-center text-sm">
                <Link href={`/${locale}/forgot-password`} className="text-primary hover:underline">{t("forgotPassword")}</Link>
                <p className="text-text-muted">{t("noAccount")} <Link href={`/${locale}/register`} className="text-primary hover:underline">Register</Link></p>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </GuestGuard>
  );
}
