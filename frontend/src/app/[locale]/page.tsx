import type { Metadata } from "next";
import { LandingPageClient } from "@/components/landing/landing-page-client";

export const metadata: Metadata = {
  title: "FinCompass — Financial Wellness for Small Businesses",
  description: "Understand your money. Make better financial decisions.",
};

export default function LandingPage() {
  return <LandingPageClient />;
}
