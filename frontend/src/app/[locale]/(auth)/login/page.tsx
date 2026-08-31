import type { Metadata } from "next";
import { LoginPageClient } from "@/components/auth/login-page-client";

export const metadata: Metadata = {
  title: "Log in to FinCompass",
  description: "Log in to FinCompass to view your business financial dashboard.",
};

export default function LoginPage() {
  return <LoginPageClient />;
}
