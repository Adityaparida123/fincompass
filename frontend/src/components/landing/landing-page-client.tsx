"use client";

import Link from "next/link";
import { useTranslations, useLocale } from "next-intl";
import { motion } from "framer-motion";
import {
  Compass, Shield, TrendingUp, PiggyBank, Wallet, Store,
  HandCoins, Landmark, MessageCircle, ArrowRight, Home, Calculator,
  CheckCircle, TrendingDown
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AnimatedFinanceBackground } from "@/components/animated-finance-background";
import { FinancialGlobe } from "@/components/3d/financial-globe";
import { FinancialOrb } from "@/components/3d/financial-orb";
import { FinancialParticles } from "@/components/3d/financial-particles";
import { GlassPanel } from "@/components/spatial/glass-panel";
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

        {/* How FinCompass Works */}
        <section id="how-it-works" className="py-20 lg:py-24 bg-surface-container/30">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="text-center">
              <h2 className="text-3xl font-bold tracking-tight text-text-primary">
                {t("howWorksTitle")}
              </h2>
              <p className="mt-4 text-lg text-text-muted max-w-2xl mx-auto">
                A structured four-step process to transform your financial understanding
              </p>
            </div>

            <div className="mt-16 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
              {[
                { number: "1", title: "connect", color: "cyan", icon: Shield },
                { number: "2", title: "understand", color: "indigo", icon: Store },
                { number: "3", title: "plan", color: "emerald", icon: Calculator },
                { number: "4", title: "improve", color: "amber", icon: TrendingUp }
              ].map((step, index) => (
                <motion.div
                  key={step.number}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className="text-center"
                >
                  <div className={`h-12 w-12 flex items-center justify-center rounded-full bg-${step.color}-500/10 mx-auto`}>
                    <step.icon className={`h-6 w-6 text-${step.color}-400`} />
                  </div>
                  <div className={`h-8 w-8 flex items-center justify-center rounded-full bg-${step.color}-500 text-white font-medium mx-auto mt-4`}>
                    {step.number}
                  </div>
                  <h3 className="mt-4 font-semibold text-text-primary">
                    {t(step.title)}
                  </h3>
                  <p className="mt-2 text-sm text-text-muted">
                    {t(`${step.title}Desc`)}
                  </p>
                </motion.div>
              ))}
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