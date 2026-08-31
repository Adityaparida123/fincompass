import type { Metadata } from "next";
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

export const metadata: Metadata = {
  title: "FinCompass — Financial Wellness for Small Businesses",
  description: "Track cash flow, analyze business health, and make better financial decisions with consent-first advisory.",
};

const features = [
  { 
    icon: TrendingUp, 
    title: "Cash-flow analysis",
    description: "See exactly where money comes in and goes out each month, with plain-language flags before you run short."
  },
  { 
    icon: Store, 
    title: "Business health check",
    description: "Get an overall health score and targeted recommendations to improve financial stability and growth potential."
  },
  { 
    icon: Calculator, 
    title: "Pricing & planning tools",
    description: "Set optimal prices, forecast revenue, and plan budgets with scenario-based modeling tools."
  },
  { 
    icon: Wallet, 
    title: "Expense tracking",
    description: "Automatically categorize expenses, spot spending trends, and identify areas for cost optimization."
  },
  { 
    icon: PiggyBank, 
    title: "Business savings goals",
    description: "Set and track progress toward savings targets for taxes, emergencies, and business expansion."
  },
  { 
    icon: HandCoins, 
    title: "Responsible borrowing",
    description: "Understand loan options, calculate affordable EMI, and plan debt repayment without straining cash flow."
  },
  { 
    icon: Landmark, 
    title: "Government schemes",
    description: "Discover and apply for relevant government subsidies, grants, and support programs for your business."
  },
  { 
    icon: MessageCircle, 
    title: "FinAI business advisor",
    description: "Get personalized financial guidance and answers to money questions in simple, actionable language."
  },
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
           <div className="flex items-center gap-3">
             <div className="flex items-center gap-1 text-sm text-text-muted">
               <Link href={`/en`} className={`px-2 py-1 rounded ${locale === 'en' ? 'bg-primary/10 text-primary' : 'hover:text-foreground'}`}>
                 EN
               </Link>
               <span className="text-border">|</span>
               <Link href={`/hi`} className={`px-2 py-1 rounded ${locale === 'hi' ? 'bg-primary/10 text-primary' : 'hover:text-foreground'}`}>
                 हिं
               </Link>
             </div>
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
             <div className="mt-2 flex items-center justify-center gap-2">
               <Compass className="h-4 w-4 text-primary" />
               <span className="text-sm font-medium text-primary">Your compass for every money decision</span>
               <Compass className="h-4 w-4 text-primary" />
             </div>
             <p className="mt-4 text-base text-text-muted sm:text-lg">
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
            <div className="mt-4 text-center">
              <button 
                className="text-sm text-primary hover:underline focus:outline-none"
                onClick={() => {
                  document.getElementById('dashboard-preview')?.scrollIntoView({ behavior: 'smooth' });
                }}
              >
                See how your health score works →
              </button>
            </div>
          </motion.div>
        </section>

        <section className="py-16 sm:py-20 bg-gradient-to-b from-background-page to-surface-container/20">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <div className="relative overflow-hidden rounded-2xl border border-border-subtle bg-surface-card shadow-lg">
              <div className="p-4 sm:p-6 border-b border-border-subtle flex items-center justify-between bg-surface-container">
                <div className="flex items-center gap-3">
                  <div className="h-3 w-3 rounded-full bg-destructive"></div>
                  <div className="h-3 w-3 rounded-full bg-warning"></div>
                  <div className="h-3 w-3 rounded-full bg-success"></div>
                </div>
                <div className="text-xs text-text-muted">Dashboard Preview</div>
              </div>
              <div className="p-4 sm:p-6">
                <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-medium text-text-muted">Cash Flow Trends</h3>
                      <div className="h-6 w-20 rounded bg-primary/10"></div>
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <div className="h-3 w-3 rounded-full bg-teal-500"></div>
                        <div className="h-2 w-full rounded-full bg-teal-500/20"></div>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="h-3 w-3 rounded-full bg-indigo-500"></div>
                        <div className="h-2 w-3/4 rounded-full bg-indigo-500/20"></div>
                      </div>
                    </div>
                  </div>
                  
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-medium text-text-muted">Health Score</h3>
                      <div className="h-6 w-16 rounded bg-success/10 text-success text-xs font-medium flex items-center justify-center">Good</div>
                    </div>
                    <div className="relative h-20 w-20 mx-auto">
                      <div className="absolute inset-0 rounded-full border-8 border-success/20"></div>
                      <div className="absolute inset-4 rounded-full border-6 border-success"></div>
                      <div className="absolute inset-0 flex items-center justify-center">
                        <span className="text-xl font-semibold">78</span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-medium text-text-muted">Top Expenses</h3>
                      <div className="h-6 w-12 rounded bg-warning/10 text-warning text-xs font-medium flex items-center justify-center">-12%</div>
                    </div>
                    <div className="space-y-3">
                      {['Rent', 'Inventory', 'Marketing', 'Salaries'].map((item, i) => (
                        <div key={item} className="flex items-center justify-between">
                          <span className="text-sm">{item}</span>
                          <div className="h-2 w-16 rounded-full bg-primary/20"></div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <p className="mt-4 text-center text-sm text-text-muted">
              See exactly how your business finances look — real data, privacy‑first design.
            </p>
          </div>
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
            <p className="mt-4 text-center text-text-muted max-w-2xl mx-auto">{t("featuresSubtitle")}</p>
            <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {features.map(({ icon: Icon, title, description }) => (
                <Card key={title} className="border-border-subtle hover:border-primary/30 transition-all duration-300 hover:shadow-lg">
                  <CardHeader>
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                        <Icon className="h-5 w-5 text-primary" />
                      </div>
                      <CardTitle className="text-lg font-semibold">{title}</CardTitle>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-text-muted leading-relaxed">{description}</p>
                  </CardContent>
                </Card>
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

        <section className="py-16 sm:py-20 border-t border-border-subtle">
          <div className="mx-auto max-w-4xl px-4 sm:px-6">
            <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
              <div className="text-center">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 mb-4">
                  <svg className="h-6 w-6 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold">Consent-First Design</h3>
                <p className="mt-2 text-sm text-text-muted">Built with a privacy-first framework. You control what data is used and for what purpose.</p>
              </div>
              <div className="text-center">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-success/10 mb-4">
                  <svg className="h-6 w-6 text-success" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold">Built for Small Businesses</h3>
                <p className="mt-2 text-sm text-text-muted">Designed specifically for micro-entrepreneurs and growing businesses to navigate financial complexity.</p>
              </div>
              <div className="text-center">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-warning/10 mb-4">
                  <svg className="h-6 w-6 text-warning" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold">Transparent Insights</h3>
                <p className="mt-2 text-sm text-text-muted">Clear, explainable financial guidance without hidden algorithms or black-box recommendations.</p>
              </div>
            </div>
            <div className="mt-12 border-t border-border-subtle pt-12 text-center">
              <div className="inline-flex items-center gap-2 rounded-full bg-primary/5 px-4 py-2">
                <span className="text-sm font-medium text-primary">SOA IDEATHON S41</span>
                <span className="text-xs text-text-muted">· Built with purpose</span>
              </div>
            </div>
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
