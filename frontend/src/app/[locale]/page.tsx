"use client";

import Link from "next/link";
import { useTranslations, useLocale } from "next-intl";
import { motion } from "framer-motion";
import {
  Compass, Shield, TrendingUp, PiggyBank, Wallet, Store,
  HandCoins, Landmark, MessageCircle, ArrowRight, Home, Calculator,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AnimatedFinanceBackground } from "@/components/animated-finance-background";
import { useAuthStore } from "@/stores/auth-store";

const features = [
  { icon: TrendingUp, title: "Cash-flow analysis" },
  { icon: Store, title: "Business health check" },
  { icon: Calculator, title: "Pricing & planning tools" },
  { icon: Wallet, title: "Expense tracking" },
  { icon: PiggyBank, title: "Business savings goals" },
  { icon: HandCoins, title: "Responsible borrowing" },
  { icon: Landmark, title: "Government schemes" },
  { icon: MessageCircle, title: "FinAI business advisor" },
];

export default function LandingPage() {
  const t = useTranslations("landing");
  const locale = useLocale();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  return (
    <div className="relative min-h-screen overflow-hidden bg-background-page">
      <AnimatedFinanceBackground />
      <header className="sticky top-0 z-30 border-b bg-surface-card/80 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-2">
            <Compass className="h-7 w-7 text-primary" />
            <div>
              <span className="text-xl font-semibold leading-tight block">FinCompass</span>
              <span className="text-[10px] font-medium uppercase tracking-[0.08em] text-text-muted leading-none">{t("tagline")}</span>
            </div>
          </div>
          <div className="flex gap-2">
            {!isAuthenticated && (
              <>
                <Link href={`/${locale}/login`}>
                  <Button variant="ghost">{t("login")}</Button>
                </Link>
                <Link href={`/${locale}/register`}>
                  <Button>{t("getStarted")}</Button>
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      <main className="relative z-10">
        <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24 lg:py-32">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mx-auto max-w-3xl text-center"
          >
            <h1 className="whitespace-pre-line text-3xl font-bold tracking-tight sm:text-4xl lg:text-5xl">
              {t("heroTitle")}
            </h1>
            <p className="mt-6 text-base text-text-muted sm:text-lg">
              {t("heroSubtitle")}
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
              {isAuthenticated ? (
                <Link href={`/${locale}/home`}>
                  <Button size="lg" className="w-full sm:w-auto">
                    <Home className="mr-1.5 h-4 w-4" />
                    {t("home")} <ArrowRight className="h-4 w-4" />
                  </Button>
                </Link>
              ) : (
                <>
                  <Link href={`/${locale}/register`}>
                    <Button size="lg" className="w-full sm:w-auto">
                      {t("getStarted")} <ArrowRight className="h-4 w-4" />
                    </Button>
                  </Link>
                  <Link href={`/${locale}/login`}>
                    <Button size="lg" variant="outline" className="w-full sm:w-auto">
                      {t("login")}
                    </Button>
                  </Link>
                </>
              )}
            </div>
          </motion.div>
        </section>

        <section className="border-y bg-surface-container/30 py-16 sm:py-20">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <h2 className="text-center text-2xl font-semibold sm:text-3xl">{t("howItWorks")}</h2>
            <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {[1, 2, 3, 4].map((step) => (
                <Card key={step}>
                  <CardHeader>
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary font-semibold">
                      {step}
                    </div>
                    <CardTitle className="text-base">{t(`step${step}Title` as "step1Title")}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-text-muted">{t(`step${step}Desc` as "step1Desc")}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        <section className="py-16 sm:py-20">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <h2 className="text-center text-2xl font-semibold sm:text-3xl">{t("features")}</h2>
            <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {features.map(({ icon: Icon, title }) => (
                <div key={title} className="flex items-center gap-3 rounded-xl border bg-surface-card p-4">
                  <Icon className="h-5 w-5 shrink-0 text-primary" />
                  <span className="text-sm font-medium">{title}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="border-t bg-surface-container/30 py-16 sm:py-20">
          <div className="mx-auto max-w-3xl px-4 text-center sm:px-6">
            <Shield className="mx-auto h-10 w-10 text-primary" />
            <h2 className="mt-4 text-2xl font-semibold">{t("privacy")}</h2>
            <p className="mt-4 text-text-muted">{t("privacyDesc")}</p>
          </div>
        </section>

        <section className="py-16 sm:py-20">
          <div className="mx-auto max-w-3xl px-4 text-center sm:px-6">
            <h2 className="text-2xl font-semibold sm:text-3xl">{t("cta")}</h2>
            {isAuthenticated ? (
              <Link href={`/${locale}/home`} className="mt-6 inline-block">
                <Button size="lg">
                  <Home className="mr-1.5 h-4 w-4" />
                  {t("home")}
                </Button>
              </Link>
            ) : (
              <Link href={`/${locale}/register`} className="mt-6 inline-block">
                <Button size="lg">{t("getStarted")}</Button>
              </Link>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
