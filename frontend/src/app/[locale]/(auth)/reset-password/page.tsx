"use client";

import { useState } from "react";
import { useLocale } from "next-intl";
import { useSearchParams, useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { GuestGuard } from "@/components/auth/auth-guard";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { api } from "@/lib/api";

const schema = z.object({
  new_password: z.string().min(8),
  confirm: z.string(),
}).refine((d) => d.new_password === d.confirm, { message: "Passwords don't match", path: ["confirm"] });

export default function ResetPasswordPage() {
  const locale = useLocale();
  const router = useRouter();
  const params = useSearchParams();
  const token = params.get("token") ?? "";
  const [done, setDone] = useState(false);
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm({ resolver: zodResolver(schema) });

  const onSubmit = async (data: z.infer<typeof schema>) => {
    await api.post("/auth/reset-password", { token, new_password: data.new_password }, { skipAuth: true });
    setDone(true);
    setTimeout(() => router.push(`/${locale}/login`), 2000);
  };

  return (
    <GuestGuard>
      <div className="flex min-h-screen items-center justify-center p-4 bg-background-page">
        <Card className="w-full max-w-md">
          <CardHeader><CardTitle className="text-lg">Reset password</CardTitle></CardHeader>
          <CardContent>
            {done ? (
              <p className="text-sm text-text-muted">Password updated. Redirecting to login...</p>
            ) : (
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
                <div>
                  <Label>New password</Label>
                  <Input type="password" {...register("new_password")} className="mt-2" />
                  {errors.new_password && <p className="mt-1.5 text-xs text-destructive">{String(errors.new_password.message)}</p>}
                </div>
                <div>
                  <Label>Confirm password</Label>
                  <Input type="password" {...register("confirm")} className="mt-2" />
                  {errors.confirm && <p className="mt-1.5 text-xs text-destructive">{String(errors.confirm.message)}</p>}
                </div>
                <Button type="submit" className="w-full" disabled={isSubmitting || !token}>Update password</Button>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </GuestGuard>
  );
}
