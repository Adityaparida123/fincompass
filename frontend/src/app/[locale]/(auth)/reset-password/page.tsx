import type { Metadata } from "next";
import { ResetPasswordClient } from "@/components/auth/reset-password-client";

export const metadata: Metadata = {
  title: "Reset Password — FinCompass",
  description: "Set a new password for your FinCompass business account.",
};

export default function ResetPasswordPage() {
  return <ResetPasswordClient />;
}
