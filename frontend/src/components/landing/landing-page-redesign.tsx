"use client";

import Link from "next/link";
import { useTranslations, useLocale } from "next-intl";
import { motion } from "framer-motion";
import {
  Compass, TrendingUp, PieChart, Target, BarChart3,
  Wallet, PiggyBank, CreditCard, Building, FileText,
  Shield, ArrowRight, ChevronRight, Home,
  BarChart, LineChart, TrendingDown, Calendar,
  Landmark, Clock, CheckCircle, ArrowUpRight
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

const financialDomains = [
  { icon: TrendingDown, title: "expensesDomain", color: "rose" },
  { icon: BarChart, title: "cashflowDomain", color: "cyan" },
  { icon: PiggyBank, title: "savingsDomain", color: "emerald" },
  { icon: Calendar, title: "budgetDomain", color: "indigo" },
  { icon: CreditCard, title: "debtDomain", color: "amber" },
  { icon: Building, title: "borrowingDomain", color: "violet" },
  { icon: Target, title: "readinessDomain", color: "teal" },
  { icon: Landmark, title: "schemesDomain", color: "blue" },
];

const processSteps = [
  { number: "01", title: "connect", icon: Shield, color: "cyan" },
  { number: "02", title: "understand", icon: BarChart3, color: "indigo" },
  { number: "03", title: "plan", icon: Target, color: "emerald" },
  { number: "04", title: "improve", icon: TrendingUp, color: "amber" },
];

const valuePropositions = [
  { title: "understandValue", icon: PieChart, color: "cyan" },
  { title: "planValue", icon: Target, color: "indigo" },
  { title: "improveValue", icon: TrendingUp, color: "emerald" },
  { title: "discoverValue", icon: Landmark, color: "amber" },
];

const journeySteps = [
  "dataStep",
  "analysisStep",
  "insightsStep",
  "recommendationsStep",
  "decisionsStep",
];

export function LandingPageRedesign() {
  const t = useTranslations("landing");
  const locale = useLocale();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  return (
    <div className="relative min-h-screen overflow-hidden bg-background-page">
      <AnimatedFinanceBackground />
      <FinancialParticles className="absolute inset-0 opacity-30" />

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
              <nav className="hidden md:ml-10 md:flex md:space-x-8">
                <Link href="#" className="rounded-md px-3 py-2 text-sm font-medium text-text-muted hover:text-text-primary hover:bg-surface-container-high/50">
                  Home
                </Link>
                <Link href="#" className="rounded-md px-3 py-2 text-sm font-medium text-text-muted hover:text-text-primary hover:bg-surface-container-high/50">
                  About
                </Link>
                <Link href="#" className="rounded-md px-3 py-2 text-sm font-medium text-text-muted hover:text-text-primary hover:bg-surface-container-high/50">
                  Features
                </Link>
                <Link href="#" className="rounded-md px-3 py-2 text-sm font-medium text-text-muted hover:text-text-primary hover:bg-surface-container-high/50">
                  How It Works
                </Link>
                <Link href="#" className="rounded-md px-3 py-2 text-sm font-medium text-text-muted hover:text-text-primary hover:bg-surface-container-high/50">
                  Financial Tools
                </Link>
                <Link href="#" className="rounded-md px-3 py-2 text-sm font-medium text-text-muted hover:text-text-primary hover:bg-surface-container-high/50">
                  Resources
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
              {isAuthenticated ? (
                <Link href={`/${locale}/home`}>
                  <Button variant="ghost" className="hidden sm:inline-flex">
                    <Home className="mr-1.5 h-4 w-4" />
                    Dashboard
                  </Button>
                </Link>
              ) : (
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
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="relative z-10">
        {/* Hero Section with 3D Visualization */}
        <section className="relative overflow-hidden pt-16 sm:pt-24 lg:pt-32">
          <div className="absolute inset-0 -z-10">
            <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-cyan-500/5 blur-3xl" />
          </div>
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="grid lg:grid-cols-2 gap-12 lg:gap-20 items-center">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-center lg:text-left"
              >
                <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-text-primary">
                  {t("heroTitle")}
                </h1>
                <p className="mt-6 text-lg text-text-muted sm:text-xl max-w-2xl">
                  {t("heroSubtitle")}
                </p>
                <div className="mt-10 flex flex-col sm:flex-row gap-4 sm:items-center">
                  {isAuthenticated ? (
                    <Link href={`/${locale}/home`}>
                      <Button size="lg" className="w-full sm:w-auto">
                        <Home className="mr-2 h-5 w-5" />
                        Go to Dashboard
                      </Button>
                    </Link>
                  ) : (
                    <>
                      <Link href={`/${locale}/register`}>
                        <Button size="lg" className="w-full sm:w-auto">
                          {t("primaryCta")}
                          <ArrowRight className="ml-2 h-5 w-5" />
                        </Button>
                      </Link>
                      <Link href="#what-is-fincompass">
                        <Button size="lg" variant="outline" className="w-full sm:w-auto">
                          {t("secondaryCta")}
                          <ChevronRight className="ml-2 h-5 w-5" />
                        </Button>
                      </Link>
                    </>
                  )}
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.2 }}
                className="relative aspect-square max-w-md mx-auto lg:max-w-none"
              >
                <div className="relative h-full w-full">
                  <FinancialGlobe size={320} className="absolute inset-0 opacity-80" />
                  <FinancialOrb status="good" score={85} size={200} className="absolute inset-0" />
                  <div className="absolute inset-0 bg-gradient-to-tr from-primary/20 to-cyan-500/10 rounded-full blur-2xl" />
                </div>
              </motion.div>
            </div>
          </div>
        </section>

        {/* What is FinCompass? */}
        <section id="what-is-fincompass" className="py-16 sm:py-20 lg:py-24">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
              <div>
                <h2 className="text-3xl font-bold tracking-tight text-text-primary sm:text-4xl">
                  {t("whatIsTitle")}
                </h2>
                <p className="mt-6 text-lg text-text-muted">
                  {t("whatIsDesc")}
                </p>
                <div className="mt-8 grid grid-cols-2 gap-4">
                  <GlassPanel className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-cyan-500/10">
                        <Shield className="h-5 w-5 text-cyan-400" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-text-primary">Privacy First</h3>
                        <p className="text-sm text-text-muted mt-1">Your data stays with you</p>
                      </div>
                    </div>
                  </GlassPanel>
                  <GlassPanel className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-500/10">
                        <Target className="h-5 w-5 text-emerald-400" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-text-primary">Actionable Insights</h3>
                        <p className="text-sm text-text-muted mt-1">Clear, practical recommendations</p>
                      </div>
                    </div>
                  </GlassPanel>
                </div>
              </div>
              <div className="relative">
                <GlassPanel className="p-8">
                  <div className="space-y-6">
                    <div className="flex items-center justify-between">
                      <h3 className="text-lg font-semibold text-text-primary">Financial Health Overview</h3>
                      <span className="text-sm font-medium text-emerald-400 bg-emerald-500/10 px-3 py-1 rounded-full">
                        Good
                      </span>
                    </div>
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-text-muted">Monthly Income</span>
                        <span className="font-medium text-text-primary">₹45,000</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-text-muted">Monthly Expenses</span>
                        <span className="font-medium text-text-primary">₹32,000</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-text-muted">Savings Rate</span>
                        <span className="font-medium text-emerald-400">29%</span>
                      </div>
                    </div>
                    <div className="pt-4 border-t border-border">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-text-muted">Net Cash Flow</span>
                        <span className="text-lg font-bold text-cyan-400">+₹13,000</span>
                      </div>
                    </div>
                  </div>
                </GlassPanel>
              </div>
            </div>
          </div>
        </section>

        {/* How FinCompass Works */}
        <section className="py-16 sm:py-20 lg:py-24 bg-gradient-to-b from-surface-container/20 to-surface-container/5">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="text-center">
              <h2 className="text-3xl font-bold tracking-tight text-text-primary sm:text-4xl">
                {t("howWorksTitle")}
              </h2>
              <p className="mt-4 text-lg text-text-muted max-w-3xl mx-auto">
                A structured four-step process to transform your financial understanding
              </p>
            </div>

            <div className="mt-16 relative">
              {/* Desktop Timeline */}
              <div className="hidden lg:block">
                <div className="grid grid-cols-4 gap-8">
                  {processSteps.map((step, index) => (
                    <motion.div
                      key={step.number}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.1 }}
                    >
                      <GlassPanel className="p-6 text-center relative">
                        <div className={`absolute -top-4 left-1/2 transform -translate-x-1/2 flex h-8 w-8 items-center justify-center rounded-full border-2 border-background-page bg-${step.color}-500 text-white font-bold`}>
                          {step.number}
                        </div>
                        <div className={`mt-4 flex h-12 w-12 items-center justify-center rounded-lg bg-${step.color}-500/10 mx-auto`}>
                          <step.icon className={`h-6 w-6 text-${step.color}-400`} />
                        </div>
                        <h3 className="mt-4 text-lg font-semibold text-text-primary">
                          {t(step.title)}
                        </h3>
                        <p className="mt-2 text-sm text-text-muted">
                          {t(`${step.title}Desc`)}
                        </p>
                        {index < 3 && (
                          <div className="absolute top-1/2 -right-4 transform -translate-y-1/2">
                            <ChevronRight className="h-6 w-6 text-border" />
                          </div>
                        )}
                      </GlassPanel>
                    </motion.div>
                  ))}
                </div>
              </div>

              {/* Mobile Timeline */}
              <div className="lg:hidden space-y-8">
                {processSteps.map((step, index) => (
                  <motion.div
                    key={step.number}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.1 }}
                    className="relative"
                  >
                    <div className="flex items-start gap-4">
                      <div className={`flex-shrink-0 flex h-8 w-8 items-center justify-center rounded-full border-2 border-background-page bg-${step.color}-500 text-white font-bold`}>
                        {step.number}
                      </div>
                      <GlassPanel className="flex-1 p-6">
                        <div className="flex items-center gap-4">
                          <div className={`flex h-12 w-12 items-center justify-center rounded-lg bg-${step.color}-500/10`}>
                            <step.icon className={`h-6 w-6 text-${step.color}-400`} />
                          </div>
                          <div className="flex-1">
                            <h3 className="text-lg font-semibold text-text-primary">
                              {t(step.title)}
                            </h3>
                            <p className="mt-1 text-sm text-text-muted">
                              {t(`${step.title}Desc`)}
                            </p>
                          </div>
                        </div>
                      </GlassPanel>
                    </div>
                    {index < 3 && (
                      <div className="absolute left-4 top-8 bottom-0 w-0.5 bg-border -z-10" style={{ top: '2rem', bottom: '-2rem' }} />
                    )}
                  </motion.div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Financial Domains */}
        <section className="py-16 sm:py-20 lg:py-24">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="text-center">
              <h2 className="text-3xl font-bold tracking-tight text-text-primary sm:text-4xl">
                {t("domainsTitle")}
              </h2>
              <p className="mt-4 text-lg text-text-muted max-w-3xl mx-auto">
                Comprehensive financial management across all key areas of your financial life
              </p>
            </div>

            <div className="mt-16 grid grid-cols-2 md:grid-cols-4 gap-6">
              {financialDomains.map((domain, index) => (
                <motion.div
                  key={domain.title}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  whileHover={{ y: -4 }}
                >
                  <GlassPanel className="p-6 text-center hover:shadow-lg transition-all duration-300">
                    <div className={`flex h-12 w-12 items-center justify-center rounded-lg bg-${domain.color}-500/10 mx-auto`}>
                      <domain.icon className={`h-6 w-6 text-${domain.color}-400`} />
                    </div>
                    <h3 className="mt-4 font-semibold text-text-primary">
                      {t(domain.title)}
                    </h3>
                    <p className="mt-2 text-sm text-text-muted">
                      Track, analyze, and optimize
                    </p>
                  </GlassPanel>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* Why FinCompass */}
        <section className="py-16 sm:py-20 lg:py-24 bg-gradient-to-b from-surface-container/20 to-surface-container/5">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="text-center">
              <h2 className="text-3xl font-bold tracking-tight text-text-primary sm:text-4xl">
                {t("whyTitle")}
              </h2>
              <p className="mt-4 text-lg text-text-muted max-w-3xl mx-auto">
                Transform how you understand and manage your finances
              </p>
            </div>

            <div className="mt-16 grid md:grid-cols-2 lg:grid-cols-4 gap-6">
              {valuePropositions.map((value, index) => (
                <motion.div
                  key={value.title}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                >
                  <GlassPanel className="p-6">
                    <div className={`flex h-12 w-12 items-center justify-center rounded-lg bg-${value.color}-500/10`}>
                      <value.icon className={`h-6 w-6 text-${value.color}-400`} />
                    </div>
                    <h3 className="mt-4 text-lg font-semibold text-text-primary">
                      {t(value.title)}
                    </h3>
                    <p className="mt-2 text-sm text-text-muted">
                      {t(`${value.title}Desc`)}
                    </p>
                  </GlassPanel>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* Financial Journey */}
        <section className="py-16 sm:py-20 lg:py-24">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="text-center">
              <h2 className="text-3xl font-bold tracking-tight text-text-primary sm:text-4xl">
                {t("journeyTitle")}
              </h2>
              <p className="mt-4 text-lg text-text-muted max-w-3xl mx-auto">
                From data to better financial decisions — every step of the way
              </p>
            </div>

            <div className="mt-16">
              {/* Desktop Journey */}
              <div className="hidden lg:block">
                <div className="relative">
                  <div className="absolute top-1/2 left-0 right-0 h-0.5 bg-gradient-to-r from-cyan-500 via-indigo-500 to-emerald-500 -translate-y-1/2" />
                  <div className="relative flex justify-between">
                    {journeySteps.map((step, index) => (
                      <div key={step} className="relative">
                        <div className="flex flex-col items-center">
                          <div className={`flex h-12 w-12 items-center justify-center rounded-full border-4 border-background-page ${
                            index === 0 ? 'bg-cyan-500' :
                            index === 1 ? 'bg-indigo-500' :
                            index === 2 ? 'bg-emerald-500' :
                            index === 3 ? 'bg-amber-500' : 'bg-primary'
                          }`}>
                            <CheckCircle className="h-6 w-6 text-white" />
                          </div>
                          <div className="mt-4 text-center">
                            <h3 className="font-semibold text-text-primary">
                              {t(step)}
                            </h3>
                            <p className="mt-1 text-sm text-text-muted">
                              Step {index + 1}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Mobile Journey */}
              <div className="lg:hidden space-y-8">
                {journeySteps.map((step, index) => (
                  <div key={step} className="flex items-start gap-4">
                    <div className={`flex-shrink-0 flex h-10 w-10 items-center justify-center rounded-full ${
                      index === 0 ? 'bg-cyan-500' :
                      index === 1 ? 'bg-indigo-500' :
                      index === 2 ? 'bg-emerald-500' :
                      index === 3 ? 'bg-amber-500' : 'bg-primary'
                    }`}>
                      <CheckCircle className="h-5 w-5 text-white" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <h3 className="font-semibold text-text-primary">
                          {t(step)}
                        </h3>
                        <span className="text-sm text-text-muted">Step {index + 1}</span>
                      </div>
                      <p className="mt-1 text-sm text-text-muted">
                        {index === 0 && "Collect and organize your financial information"}
                        {index === 1 && "Identify patterns and trends in your finances"}
                        {index === 2 && "Gain actionable understanding of your situation"}
                        {index === 3 && "Receive personalized guidance and next steps"}
                        {index === 4 && "Make informed choices for better outcomes"}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
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

      {/* Institutional Footer */}
      <footer className="border-t border-border bg-surface-card">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="py-12">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-8">
              <div className="lg:col-span-2">
                <div className="flex items-center gap-2">
                  <Compass className="h-8 w-8 text-primary" />
                  <div>
                    <span className="text-xl font-semibold leading-tight text-text-primary">FinCompass</span>
                    <span className="block text-[10px] font-medium uppercase tracking-[0.08em] text-text-muted leading-none">
                      Financial Intelligence Platform
                    </span>
                  </div>
                </div>
                <p className="mt-4 text-sm text-text-muted max-w-md">
                  Your complete financial intelligence platform for understanding expenses, cash flow, savings, budgets, debt, borrowing and financial readiness.
                </p>
              </div>

              <div>
                <h3 className="text-sm font-semibold text-text-primary uppercase tracking-wider">
                  {t("footerProduct")}
                </h3>
                <ul className="mt-4 space-y-3">
                  <li>
                    <Link href="#" className="text-sm text-text-muted hover:text-text-primary">
                      Features
                    </Link>
                  </li>
                  <li>
                    <Link href="#" className="text-sm text-text-muted hover:text-text-primary">
                      How It Works
                    </Link>
                  </li>
                  <li>
                    <Link href="#" className="text-sm text-text-muted hover:text-text-primary">
                      Pricing
                    </Link>
                  </li>
                  <li>
                    <Link href="#" className="text-sm text-text-muted hover:text-text-primary">
                      Updates
                    </Link>
                  </li>
                </ul>
              </div>

              <div>
                <h3 className="text-sm font-semibold text-text-primary uppercase tracking-wider">
                  {t("footerTools")}
                </h3>
                <ul className="mt-4 space-y-3">
                  <li>
                    <Link href="#" className="text-sm text-text-muted hover:text-text-primary">
                      Expense Tracker
                    </Link>
                  </li>
                  <li>
                    <Link href="#" className="text-sm text-text-muted hover:text-text-primary">
                      Budget Planner
                    </Link>
                  </li>
                  <li>
                    <Link href="#" className="text-sm text-text-muted hover:text-text-primary">
                      Loan Calculator
                    </Link>
                  </li>
                  <li>
                    <Link href="#" className="text-sm text-text-muted hover:text-text-primary">
                      Savings Goals
                    </Link>
                  </li>
                </ul>
              </div>

              <div>
                <h3 className="text-sm font-semibold text-text-primary uppercase tracking-wider">
                  {t("footerResources")}
                </h3>
                <ul className="mt-4 space-y-3">
                  <li>
                    <Link href="#" className="text-sm text-text-muted hover:text-text-primary">
                      Documentation
                    </Link>
                  </li>
                  <li>
                    <Link href="#" className="text-sm text-text-muted hover:text-text-primary">
                      Help Center
                    </Link>
                  </li>
                  <li>
                    <Link href="#" className="text-sm text-text-muted hover:text-text-primary">
                      Blog
                    </Link>
                  </li>
                  <li>
                    <Link href="#" className="text-sm text-text-muted hover:text-text-primary">
                      Community
                    </Link>
                  </li>
                </ul>
              </div>
            </div>

            <div className="mt-8 pt-8 border-t border-border">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="text-sm text-text-muted">
                  © {new Date().getFullYear()} FinCompass. All rights reserved.
                </div>
                <div className="flex items-center gap-6 text-sm">
                  <Link href="#" className="text-text-muted hover:text-text-primary">
                    {t("footerPrivacy")}
                  </Link>
                  <Link href="#" className="text-text-muted hover:text-text-primary">
                    {t("footerTerms")}
                  </Link>
                  <Link href="#" className="text-text-muted hover:text-text-primary">
                    {t("footerContact")}
                  </Link>
                  <Link href={`/${locale}/login`} className="text-primary hover:text-primary/80">
                    {t("footerLogin")}
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}