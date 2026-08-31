import type { Metadata } from "next";
import { RegisterPageClient } from "@/components/auth/register-page-client";

export const metadata: Metadata = {
  title: "Create your FinCompass account",
  description: "Create your FinCompass account — start tracking cash flow, savings, and business health for free.",
};

export default function RegisterPage() {
  return <RegisterPageClient />;
}
