"use client";

import Link from "next/link";
import { useTranslations, useLocale } from "next-intl";
import { motion } from "framer-motion";
import {
  Compass, Shield, TrendingUp, PiggyBank, Wallet, Store,
  HandCoins, Landmark, MessageCircle, ArrowRight, Home, Calculator,
  CheckCircle, TrendingDown, FileText
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AnimatedFinanceBackground } from "@/components/animated-finance-background";
import { FinancialGlobe } from "@/components/3d/financial-globe";
import { FinancialOrb } from "@/components/3d/financial-orb";
import { FinancialParticles } from "@/components/3d/financial-particles";
import { GlassPanel } from "@/components/spatial/glass-panel";
import { SpatialBadge } from "@/components/spatial/spatial-badge";
import { SpatialMetric } from "@/components/spatial/spatial-metric";
import { useAuthStore } from "@/stores/auth-store";

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

const howToUseSteps = [
  {
    number: "01",
    label: "Import",
    title: "Import Your Transactions",
    description: "Upload multiple financial transactions using a structured Excel or CSV file.",
    icon: FileText,
    glow: "cyan" as const,
  },
  {
    number: "02",
    label: "Organize",
    title: "Let FinCompass Organize the Data",
    description: "FinCompass validates, normalizes, categorizes, and separates business and personal transactions so your financial data is ready for analysis.",
    icon: CheckCircle,
    glow: "indigo" as const,
  },
  {
    number: "03",
    label: "Understand",
    title: "Understand Your Business",
    description: "Explore revenue, expenses, profit, cash flow, spending patterns, and business performance from one command center.",
    icon: Store,
    glow: "emerald" as const,
  },
  {
    number: "04",
    label: "Plan",
    title: "Plan Ahead With Confidence",
    description: "Analyze cash flow, forecast future financial trends, and understand your credit readiness using transparent financial indicators.",
    icon: Calculator,
    glow: "amber" as const,
  },
  {
    number: "05",
    label: "Ask FinAI",
    title: "Make Better Decisions With FinAI",
    description: "Ask FinAI questions about your business and get recommendations based on your financial context.",
    icon: MessageCircle,
    glow: "rose" as const,
  },
];

export function LandingPageClient() {
  const t = useTranslations("landing");
  const locale = useLocale();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  return (
    <div className="relative min-h-screen bg-background-page">
      <AnimatedFinanceBackground />
      <FinancialParticles className="absolute inset-0 opacity-20" />

      {/* Institutional Navigation */}
      <header className="sticky top-0 z-40 border-b border-border/40 bg-surface-card/90 backdrop-blur supports-[backdrop-filter]:bg-surface-card/60">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <Compass className="h-7 w-7 text-primary" />
                <div className="flex flex-col">
                  <span className="text-lg font-semibold leading-tight text-text-primary">FinCompass</span>
                  <span className="text-[10px] font-medium uppercase tracking-[0.08em] text-text-muted leading-none">
                    Financial Intelligence Platform
                  </span>
                </div>
              </div>
               <nav className="hidden md:ml-10 md:flex md:space-x-6">
                 <Link href="#what-is-fincompass" className="px-3 py-2 text-sm font-medium text-text-muted hover:text-text-primary transition-colors">
                   About
                 </Link>
                 <Link href="#how-it-works" className="px-3 py-2 text-sm font-medium text-text-muted hover:text-text-primary transition-colors">
                   How It Works
                 </Link>
                 <Link href="#financial-domains" className="px-3 py-2 text-sm font-medium text-text-muted hover:text-text-primary transition-colors">
                   Features
                 </Link>
                 <Link href="#why-fincompass" className="px-3 py-2 text-sm font-medium text-text-muted hover:text-text-primary transition-colors">
                   Benefits
                 </Link>
               </nav>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1 text-sm text-text-muted">
                <Link href={`/en`} className={`px-2 py-1 rounded ${locale === 'en' ? 'bg-primary/10 text-primary' : 'hover:text-foreground'}`}>
                  EN
                </Link>
                <span className="text-border">|</span>
                <Link href={`/hi`} className={`px-2 py-1 rounded ${locale === 'hi' ? 'bg-primary/10 text-primary' : 'hover:text-foreground'}`}>
                  हिं
                </Link>
              </div>
              {!isAuthenticated ? (
                <>
                  <Link href={`/${locale}/login`}>
                    <Button variant="ghost" className="hidden sm:inline-flex">
                      {t("login")}
                    </Button>
                  </Link>
                  <Link href={`/${locale}/register`}>
                    <Button className="hidden sm:inline-flex">
                      {t("primaryCta")}
                    </Button>
                  </Link>
                </>
              ) : (
                <Link href={`/${locale}/home`}>
                  <Button variant="ghost" className="hidden sm:inline-flex">
                    <Home className="mr-1.5 h-4 w-4" />
                    Dashboard
                  </Button>
                </Link>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="relative z-10">
        {/* Hero Section with 3D Visualization */}
        <section className="section-padding overflow-hidden">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="grid lg:grid-cols-2 gap-16 items-center">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-center lg:text-left"
              >
                 <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-text-primary">
                   {t("heroTitle")}
                 </h1>
                 <p className="mt-4 text-lg text-text-muted sm:text-xl max-w-2xl">
                   {t("heroSubtitle")}
                 </p>
                 <div className="mt-8 flex flex-col sm:flex-row gap-3">
                   <Link href={`/${locale}/register`}>
                     <Button size="lg" className="w-full sm:w-auto">
                       {t("primaryCta")}
                     </Button>
                   </Link>
                   <Link href="#what-is-fincompass">
                     <Button size="lg" variant="outline" className="w-full sm:w-auto">
                       Learn More
                     </Button>
                   </Link>
                 </div>
              </motion.div>

               <motion.div
                 initial={{ opacity: 0, scale: 0.9 }}
                 animate={{ opacity: 1, scale: 1 }}
                 transition={{ delay: 0.2 }}
                 className="relative aspect-square max-w-sm mx-auto lg:max-w-none"
               >
                 <FinancialGlobe size={280} className="absolute inset-0 opacity-90" />
               </motion.div>
            </div>
          </div>
        </section>

        {/* What is FinCompass? */}
        <section id="what-is-fincompass" className="py-20 lg:py-24">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="grid lg:grid-cols-2 gap-16 items-center">
               <div>
                 <h2 className="text-3xl font-bold tracking-tight text-text-primary">
                   {t("whatIsTitle")}
                 </h2>
                 <p className="mt-4 text-lg text-text-muted">
                   {t("whatIsDesc")}
                 </p>
                 <div className="mt-8 flex items-center gap-4">
                   <div className="flex items-center gap-2">
                     <div className="h-3 w-3 rounded-full bg-cyan-500" />
                     <span className="text-sm text-text-muted">Privacy first design</span>
                   </div>
                   <div className="flex items-center gap-2">
                     <div className="h-3 w-3 rounded-full bg-emerald-500" />
                     <span className="text-sm text-text-muted">Actionable insights</span>
                   </div>
                 </div>
               </div>
               <div className="relative flex items-center justify-center">
                 <FinancialOrb status="good" score={75} size={280} className="opacity-90" />
               </div>
            </div>
          </div>
        </section>

        {/* How to Use FinCompass */}
        <section id="how-it-works" className="relative overflow-hidden bg-surface-container/30 py-20 lg:py-24">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="text-center">
              <SpatialBadge variant="cyan" pulse>PRODUCT WALKTHROUGH</SpatialBadge>
              <h2 className="mt-4 text-3xl font-bold tracking-tight text-text-primary sm:text-4xl">
                How to Use FinCompass
              </h2>
              <p className="mx-auto mt-4 max-w-2xl text-lg text-text-muted">
                From financial data to clear business decisions — in a few simple steps.
              </p>
            </div>

            <ol className="relative mt-14 grid gap-8 lg:grid-cols-5 lg:gap-4">
              <div className="absolute bottom-10 left-5 top-10 w-px bg-border lg:bottom-auto lg:left-[10%] lg:right-[10%] lg:top-10 lg:h-px lg:w-auto">
                <motion.div
                  initial={{ scaleY: 0, scaleX: 0 }}
                  whileInView={{ scaleY: 1, scaleX: 1 }}
                  viewport={{ once: true, amount: 0.4 }}
                  transition={{ duration: 1.1, ease: "easeOut" }}
                  className="h-full origin-top bg-primary/60 lg:origin-left"
                />
              </div>
              {howToUseSteps.map((step, index) => (
                <motion.li
                  key={step.label}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, amount: 0.2 }}
                  transition={{ delay: index * 0.08, duration: 0.45 }}
                  className="relative z-10 flex min-w-0 items-start gap-4 lg:block"
                >
                  <div className="flex shrink-0 flex-col items-center lg:mb-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full border border-primary/40 bg-surface-card text-sm font-semibold text-primary shadow-[0_0_18px_rgba(20,184,166,0.16)]">
                      {step.number}
                    </div>
                  </div>
                  <GlassPanel glow={step.glow} hudCorners className="w-full p-4 transition-transform duration-200 hover:-translate-y-1 lg:min-h-[296px]">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                        <step.icon className="h-5 w-5" aria-hidden="true" />
                      </div>
                      <SpatialBadge variant={step.glow}>{step.label}</SpatialBadge>
                    </div>
                    <h3 className="mt-4 text-base font-semibold leading-snug text-text-primary">{step.title}</h3>
                    <p className="mt-2 text-sm leading-6 text-text-muted">{step.description}</p>

                    {index === 0 && (
                      <div className="mt-4 rounded-lg border border-border-subtle bg-surface-container-low p-3" aria-label="Illustrative structured data preview">
                        <div className="mb-2 flex items-center justify-between text-[10px] font-semibold uppercase tracking-wider text-text-muted">
                          <span>transactions.csv</span>
                          <span className="text-emerald-400">.CSV / .XLSX</span>
                        </div>
                        <div className="space-y-1.5 text-[11px] text-text-secondary">
                          <div className="grid grid-cols-3 gap-2 border-b border-border pb-1 font-medium text-text-muted"><span>Date</span><span>Description</span><span>Amount</span></div>
                          <div className="grid grid-cols-3 gap-2"><span>12 May</span><span>Supplier</span><span>₹ —</span></div>
                          <div className="grid grid-cols-3 gap-2"><span>13 May</span><span>Sales receipt</span><span>₹ —</span></div>
                        </div>
                      </div>
                    )}

                    {index === 1 && (
                      <div className="mt-4 flex flex-wrap items-center gap-1.5 text-[10px] font-medium uppercase tracking-wider text-text-muted">
                        {['Import', 'Validate', 'Categorize', 'Analyze'].map((stage, stageIndex) => (
                          <span key={stage} className="inline-flex items-center gap-1.5">
                            <span className="rounded border border-border-subtle bg-surface-container-low px-1.5 py-1">{stage}</span>
                            {stageIndex < 3 && <span className="text-primary" aria-hidden="true">→</span>}
                          </span>
                        ))}
                      </div>
                    )}

                    {index === 2 && (
                      <div className="mt-4 grid grid-cols-2 gap-2" aria-label="Illustrative business metrics">
                        {['Revenue', 'Expenses', 'Profit', 'Cash Flow'].map((metric) => (
                          <div key={metric} className="rounded-lg border border-border-subtle bg-surface-container-low px-2.5 py-2">
                            <p className="text-[10px] text-text-muted">{metric}</p>
                            <p className="mt-1 text-sm font-semibold text-text-primary">—</p>
                          </div>
                        ))}
                      </div>
                    )}

                    {index === 3 && (
                      <div className="mt-4 space-y-2 rounded-lg border border-border-subtle bg-surface-container-low p-3 text-xs">
                        <div className="flex items-center justify-between"><span className="text-text-muted">CFO</span><span className="text-text-secondary">Cash Flow from Operations</span></div>
                        <div className="flex items-center justify-between"><span className="text-text-muted">CFI</span><span className="text-text-secondary">Cash Flow from Investing</span></div>
                        <div className="flex items-center justify-between"><span className="text-text-muted">CFF</span><span className="text-text-secondary">Cash Flow from Financing</span></div>
                      </div>
                    )}

                    {index === 4 && (
                      <div className="mt-4 space-y-2 text-xs text-text-secondary">
                        {['What are my biggest financial risks?', 'How can I improve my cash position?', 'Where can I reduce unnecessary spending?'].map((question) => (
                          <div key={question} className="rounded-lg border border-border-subtle bg-surface-container-low px-3 py-2">{question}</div>
                        ))}
                        <p className="pt-1 text-[10px] leading-4 text-text-muted">FinAI interprets your financial context and insights; calculations remain grounded in FinCompass data.</p>
                      </div>
                    )}
                  </GlassPanel>
                </motion.li>
              ))}
            </ol>

            <div className="mt-14 text-center">
              <p className="text-lg font-semibold text-text-primary">Ready to understand your business better?</p>
              <Link href={`/${locale}/register`} className="mt-5 inline-block">
                <Button size="lg">
                  Explore FinCompass
                  <ArrowRight className="ml-2 h-4 w-4" aria-hidden="true" />
                </Button>
              </Link>
            </div>
          </div>
        </section>

        {/* Financial Domains */}
        <section id="financial-domains" className="py-20 lg:py-24">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="text-center">
              <h2 className="text-3xl font-bold tracking-tight text-text-primary">
                {t("domainsTitle")}
              </h2>
              <p className="mt-4 text-lg text-text-muted max-w-2xl mx-auto">
                Comprehensive financial management across all key areas
              </p>
            </div>

            <div className="mt-16 grid grid-cols-2 md:grid-cols-4 gap-6">
              {[
                { title: "expensesDomain", color: "rose", icon: TrendingDown },
                { title: "cashflowDomain", color: "cyan", icon: Store },
                { title: "savingsDomain", color: "emerald", icon: PiggyBank },
                { title: "budgetDomain", color: "indigo", icon: Calculator },
                { title: "debtDomain", color: "amber", icon: Wallet },
                { title: "borrowingDomain", color: "violet", icon: HandCoins },
                { title: "readinessDomain", color: "teal", icon: Shield },
                { title: "schemesDomain", color: "blue", icon: Landmark }
              ].map((domain, index) => (
                <div
                  key={domain.title}
                  className="p-6 text-center border border-border rounded-xl hover:border-primary/20 transition-colors"
                >
                  <div className={`h-12 w-12 flex items-center justify-center rounded-lg bg-${domain.color}-500/10 mx-auto`}>
                    <domain.icon className={`h-6 w-6 text-${domain.color}-400`} />
                  </div>
                  <h3 className="mt-4 font-medium text-text-primary">
                    {t(domain.title)}
                  </h3>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Why FinCompass */}
        <section id="why-fincompass" className="py-20 lg:py-24 bg-surface-container/30">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="text-center">
              <h2 className="text-3xl font-bold tracking-tight text-text-primary">
                {t("whyTitle")}
              </h2>
              <p className="mt-4 text-lg text-text-muted max-w-2xl mx-auto">
                Transform how you understand and manage your finances
              </p>
            </div>

            <div className="mt-16 grid md:grid-cols-2 gap-8">
              {[
                { title: "understandValue", color: "cyan", icon: Store },
                { title: "planValue", color: "indigo", icon: Calculator },
                { title: "improveValue", color: "emerald", icon: TrendingUp },
                { title: "discoverValue", color: "amber", icon: Landmark }
              ].map((value, index) => (
                <div
                  key={value.title}
                  className="p-6 rounded-xl border border-border"
                >
                  <div className={`h-10 w-10 flex items-center justify-center rounded-lg bg-${value.color}-500/10`}>
                    <value.icon className={`h-5 w-5 text-${value.color}-400`} />
                  </div>
                  <h3 className="mt-4 font-semibold text-text-primary">
                    {t(value.title)}
                  </h3>
                  <p className="mt-2 text-text-muted">
                    {t(`${value.title}Desc`)}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Final CTA */}
        <section className="py-20 lg:py-24">
          <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 text-center">
            <h2 className="text-3xl font-bold tracking-tight text-text-primary">
              Ready to take control of your finances?
            </h2>
            <p className="mt-4 text-lg text-text-muted">
              Join thousands who have transformed their financial understanding with FinCompass
            </p>
            <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
              <Link href={`/${locale}/register`}>
                <Button size="lg">
                  Get Started Free
                </Button>
              </Link>
              <Link href={`/${locale}/login`}>
                <Button size="lg" variant="outline">
                  Already have an account?
                </Button>
              </Link>
            </div>
          </div>
        </section>

        {/* Final CTA */}
        <section className="py-16 sm:py-20 lg:py-24">
          <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 text-center">
            <h2 className="text-3xl font-bold tracking-tight text-text-primary sm:text-4xl">
              {t("finalCta")}
            </h2>
            <p className="mt-4 text-lg text-text-muted">
              Join thousands who have transformed their financial understanding with FinCompass
            </p>
            <div className="mt-10 flex flex-col sm:flex-row gap-4 justify-center">
              {isAuthenticated ? (
                <Link href={`/${locale}/home`}>
                  <Button size="lg">
                    <Home className="mr-2 h-5 w-5" />
                    Go to Dashboard
                  </Button>
                </Link>
              ) : (
                <>
                  <Link href={`/${locale}/register`}>
                    <Button size="lg">
                      {t("primaryCta")}
                      <ArrowRight className="ml-2 h-5 w-5" />
                    </Button>
                  </Link>
                  <Link href={`/${locale}/login`}>
                    <Button size="lg" variant="outline">
                      {t("login")}
                    </Button>
                  </Link>
                </>
              )}
            </div>
          </div>
        </section>
      </main>

       {/* Footer */}
      <footer className="border-t border-border bg-surface-card">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <Compass className="h-6 w-6 text-primary" />
                <span className="text-lg font-semibold text-text-primary">FinCompass</span>
              </div>
              <p className="text-sm text-text-muted">
                Your financial intelligence platform for better money management.
              </p>
            </div>

            <div>
              <h3 className="text-sm font-medium text-text-primary mb-3">Product</h3>
              <ul className="space-y-2 text-sm">
                <li>
                  <Link href="#what-is-fincompass" className="text-text-muted hover:text-text-primary">
                    About
                  </Link>
                </li>
                <li>
                  <Link href="#financial-domains" className="text-text-muted hover:text-text-primary">
                    Features
                  </Link>
                </li>
                <li>
                  <Link href="#how-it-works" className="text-text-muted hover:text-text-primary">
                    How It Works
                  </Link>
                </li>
              </ul>
            </div>

            <div>
              <h3 className="text-sm font-medium text-text-primary mb-3">Company</h3>
              <ul className="space-y-2 text-sm">
                <li>
                  <Link href="#" className="text-text-muted hover:text-text-primary">
                    Privacy
                  </Link>
                </li>
                <li>
                  <Link href="#" className="text-text-muted hover:text-text-primary">
                    Terms
                  </Link>
                </li>
                <li>
                  <Link href="#" className="text-text-muted hover:text-text-primary">
                    Contact
                  </Link>
                </li>
              </ul>
            </div>

            <div>
              <h3 className="text-sm font-medium text-text-primary mb-3">Get Started</h3>
              <div className="space-y-2 text-sm">
                <Link href={`/${locale}/register`} className="block text-text-muted hover:text-text-primary">
                  Sign Up Free
                </Link>
                <Link href={`/${locale}/login`} className="block text-text-muted hover:text-text-primary">
                  Log In
                </Link>
              </div>
            </div>
          </div>

          <div className="mt-8 pt-8 border-t border-border text-center text-sm text-text-muted">
            © {new Date().getFullYear()} FinCompass. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
}