"use client";

import { useState } from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { GuestGuard } from "@/components/auth/auth-guard";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { api } from "@/lib/api";

const schema = z.object({ email: z.string().email() });

export default function ForgotPasswordPage() {
  const locale = useLocale();
  const [sent, setSent] = useState(false);
  const { register, handleSubmit, formState: { isSubmitting } } = useForm({ resolver: zodResolver(schema) });

  const onSubmit = async (data: z.infer<typeof schema>) => {
    await api.post("/auth/forgot-password", data, { skipAuth: true });
    setSent(true);
  };

  return (
    <GuestGuard>
      <div className="flex min-h-screen items-center justify-center p-4 bg-background-page">
        <Card className="w-full max-w-md">
          <CardHeader><CardTitle className="text-lg">Forgot password</CardTitle></CardHeader>
          <CardContent>
            {sent ? (
              <p className="text-sm text-text-muted">If that email exists, a reset link has been issued.</p>
            ) : (
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
                <div>
                  <Label>Email</Label>
                  <Input type="email" {...register("email")} className="mt-2" />
                </div>
                <Button type="submit" className="w-full" disabled={isSubmitting}>Send reset link</Button>
              </form>
            )}
            <Link href={`/${locale}/login`} className="mt-6 block text-center text-sm text-primary hover:underline">Back to login</Link>
          </CardContent>
        </Card>
      </div>
    </GuestGuard>
  );
}
