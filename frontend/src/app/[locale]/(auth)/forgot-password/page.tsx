import type { Metadata } from "next";
import { ForgotPasswordClient } from "@/components/auth/forgot-password-client";

export const metadata: Metadata = {
  title: "Forgot Password — FinCompass",
  description: "Reset your FinCompass password to regain access to your business financial dashboard.",
};

export default function ForgotPasswordPage() {
  return <ForgotPasswordClient />;
}
