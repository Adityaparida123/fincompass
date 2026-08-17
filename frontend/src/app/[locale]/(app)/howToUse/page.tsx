"use client";

import {
  Upload,
  BarChart3,
  TrendingUp,
  PiggyBank,
  Wallet,
  CreditCard,
  Bot,
  ShieldCheck,
  ArrowRight,
  CheckCircle2,
} from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const steps = [
  {
    number: "01",
    icon: Upload,
    title: "Add your transactions",
    description:
      "Start by adding your financial transactions manually or importing your bank statement using CSV or Excel.",
  },
  {
    number: "02",
    icon: BarChart3,
    title: "Understand your spending",
    description:
      "FinCompass automatically organizes your transactions and helps you understand where your money is going.",
  },
  {
    number: "03",
    icon: TrendingUp,
    title: "Check your cash flow",
    description:
      "See your income, expenses and available cash flow so you can understand your monthly financial position.",
  },
  {
    number: "04",
    icon: PiggyBank,
    title: "Build your savings",
    description:
      "Set savings goals and understand how much you can realistically save based on your financial activity.",
  },
  {
    number: "05",
    icon: Wallet,
    title: "Create a budget",
    description:
      "Set category-wise budgets and monitor whether your actual spending is within your planned limits.",
  },
  {
    number: "06",
    icon: CreditCard,
    title: "Understand borrowing",
    description:
      "Use loan and affordability tools to understand EMI, repayment burden and whether borrowing is affordable.",
  },
  {
    number: "07",
    icon: Bot,
    title: "Ask FinAI",
    description:
      "Use FinAI to ask questions about your spending, savings, cash flow and responsible financial decisions.",
  },
  {
    number: "08",
    icon: ShieldCheck,
    title: "Control your data",
    description:
      "Manage your consent settings and decide which financial information can be used for analysis and personalization.",
  },
];

const features = [
  "Understand your spending patterns",
  "Track income and expenses",
  "Monitor cash flow",
  "Set savings goals",
  "Create and monitor budgets",
  "Check borrowing affordability",
  "Get explainable financial insights",
  "Control your financial-data consent",
];

export default function HowToUsePage() {
  return (
    <div className="space-y-8 pb-10">
      {/* Hero */}
      <section className="rounded-2xl border bg-card p-6 shadow-sm sm:p-8">
        <div className="max-w-3xl">
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
            <Bot className="h-6 w-6 text-primary" />
          </div>

          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
            How to Use FinCompass
          </h1>

          <p className="mt-3 text-base leading-7 text-muted-foreground">
            FinCompass helps you understand your money, improve your financial
            habits and make responsible financial decisions using your
            consented financial data.
          </p>
        </div>
      </section>

      {/* Quick start */}
      <section>
        <div className="mb-5">
          <h2 className="text-2xl font-semibold">Getting Started</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Follow these steps to get the most out of FinCompass.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          {steps.map((step) => {
            const Icon = step.icon;

            return (
              <Card
                key={step.number}
                className="group transition-all duration-200 hover:-translate-y-1 hover:shadow-md"
              >
                <CardHeader>
                  <div className="flex items-start gap-4">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10">
                      <Icon className="h-5 w-5 text-primary" />
                    </div>

                    <div className="flex-1">
                      <div className="mb-1 text-xs font-semibold tracking-wider text-primary">
                        STEP {step.number}
                      </div>

                      <CardTitle className="text-base">
                        {step.title}
                      </CardTitle>
                    </div>
                  </div>
                </CardHeader>

                <CardContent>
                  <p className="text-sm leading-6 text-muted-foreground">
                    {step.description}
                  </p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </section>

      {/* What you can do */}
      <section>
        <Card>
          <CardHeader>
            <CardTitle>What you can do with FinCompass</CardTitle>
          </CardHeader>

          <CardContent>
            <div className="grid gap-3 sm:grid-cols-2">
              {features.map((feature) => (
                <div
                  key={feature}
                  className="flex items-center gap-3 rounded-lg border bg-muted/30 p-3"
                >
                  <CheckCircle2 className="h-5 w-5 shrink-0 text-primary" />

                  <span className="text-sm">{feature}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </section>

      {/* Recommended flow */}
      <section>
        <Card className="overflow-hidden">
          <CardHeader>
            <CardTitle>A simple financial-health workflow</CardTitle>
          </CardHeader>

          <CardContent>
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className="rounded-lg bg-primary/10 px-3 py-2 font-medium text-primary">
                Transactions
              </span>

              <ArrowRight className="h-4 w-4 text-muted-foreground" />

              <span className="rounded-lg bg-primary/10 px-3 py-2 font-medium text-primary">
                Spending
              </span>

              <ArrowRight className="h-4 w-4 text-muted-foreground" />

              <span className="rounded-lg bg-primary/10 px-3 py-2 font-medium text-primary">
                Cash Flow
              </span>

              <ArrowRight className="h-4 w-4 text-muted-foreground" />

              <span className="rounded-lg bg-primary/10 px-3 py-2 font-medium text-primary">
                Savings
              </span>

              <ArrowRight className="h-4 w-4 text-muted-foreground" />

              <span className="rounded-lg bg-primary/10 px-3 py-2 font-medium text-primary">
                Budget
              </span>

              <ArrowRight className="h-4 w-4 text-muted-foreground" />

              <span className="rounded-lg bg-primary/10 px-3 py-2 font-medium text-primary">
                Responsible Decisions
              </span>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* Privacy */}
      <section className="rounded-2xl border border-primary/20 bg-primary/5 p-6">
        <div className="flex gap-4">
          <ShieldCheck className="mt-1 h-6 w-6 shrink-0 text-primary" />

          <div>
            <h2 className="font-semibold">Your data, your control</h2>

            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              FinCompass is designed around consented financial data. You can
              review and revoke permissions from the Privacy & Consent section
              whenever you want.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}