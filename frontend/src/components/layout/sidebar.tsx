"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations, useLocale } from "next-intl";
import {
  LayoutDashboard, Receipt, TrendingUp, PiggyBank, Wallet,
  CreditCard, HandCoins, Gauge, Lightbulb, Landmark, Bell,
  Trash2, Shield, User, Menu, X, Compass,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useUIStore } from "@/stores/ui-store";
import { Button } from "@/components/ui/button";

const navItems = [
  { key: "dashboard", href: "/dashboard", icon: LayoutDashboard },
  { key: "expenses", href: "/expenses", icon: Receipt },
  { key: "cashflow", href: "/cashflow", icon: TrendingUp },
  { key: "savings", href: "/savings", icon: PiggyBank },
  { key: "budget", href: "/budget", icon: Wallet },
  { key: "debt", href: "/debt", icon: CreditCard },
  { key: "borrowing", href: "/borrowing", icon: HandCoins },
  { key: "readiness", href: "/readiness", icon: Gauge },
  { key: "recommendations", href: "/recommendations", icon: Lightbulb },
  { key: "schemes", href: "/schemes", icon: Landmark },
  { key: "notifications", href: "/notifications", icon: Bell },
  { key: "recycleBin", href: "/recycle-bin", icon: Trash2 },
  { key: "consent", href: "/consent", icon: Shield },
  { key: "profile", href: "/profile", icon: User },
] as const;

export function Sidebar() {
  const t = useTranslations("nav");
  const locale = useLocale();
  const pathname = usePathname();
  const { sidebarOpen, setSidebarOpen } = useUIStore();

  return (
    <>
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-hidden
        />
      )}
      <aside
        className={cn(
          "hidden lg:flex flex-col h-screen w-64 fixed left-0 top-0 bg-surface-card border-r border-border-subtle z-50 py-6 transition-transform duration-200",
          sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0",
        )}
      >
        <div className="px-6 mb-8 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center border border-primary/20">
            <Compass className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-[24px] leading-[32px] font-semibold text-primary">FinCompass</h1>
            <p className="text-[12px] leading-[16px] font-semibold uppercase tracking-[0.05em] text-text-muted mt-1">Premium Wealth Management</p>
          </div>
        </div>
        <div className="flex-1 flex flex-col gap-0.5 px-2">
          {navItems.map(({ key, href, icon: Icon }) => {
            const fullHref = `/${locale}${href}`;
            const active = pathname === fullHref || pathname.startsWith(fullHref + "/");
            return (
              <Link
                key={key}
                href={fullHref}
                className={cn(
                  "flex items-center gap-3 px-4 py-3 text-sm transition-all duration-200 ease-in-out border-l-4",
                  active
                    ? "text-primary border-primary bg-primary-container/10 font-medium"
                    : "text-text-muted hover:text-foreground hover:bg-surface-container border-transparent",
                )}
                onClick={() => setSidebarOpen(false)}
              >
                <Icon className="h-5 w-5 shrink-0" />
                <span className="truncate">{t(key)}</span>
              </Link>
            );
          })}
        </div>
        <div className="mt-auto px-4 pt-6">
          <div className="bg-gradient-to-br from-primary-container/20 to-surface-container-high border border-primary/20 rounded-xl p-4 text-center">
            <p className="text-[14px] leading-[20px] text-on-surface-variant mb-3">Unlock advanced analytics and priority support.</p>
            <button className="w-full bg-primary text-on-primary-container font-medium py-2 rounded-lg glow-hover transition-all text-sm">
              Upgrade to Pro
            </button>
          </div>
        </div>
      </aside>

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div className="fixed inset-y-0 left-0 z-50 flex w-64 flex-col bg-surface-card border-r border-border-subtle lg:hidden transition-transform duration-200">
          <div className="px-6 py-6 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center border border-primary/20">
                <Compass className="h-5 w-5 text-primary" />
              </div>
              <span className="text-[24px] leading-[32px] font-semibold text-primary">FinCompass</span>
            </div>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setSidebarOpen(false)}>
              <X className="h-4 w-4" />
            </Button>
          </div>
          <nav className="flex-1 overflow-y-auto px-2">
            {navItems.map(({ key, href, icon: Icon }) => {
              const fullHref = `/${locale}${href}`;
              const active = pathname === fullHref || pathname.startsWith(fullHref + "/");
              return (
                <Link
                  key={key}
                  href={fullHref}
                  className={cn(
                    "flex items-center gap-3 px-4 py-3 text-sm transition-all duration-200 ease-in-out border-l-4",
                    active
                      ? "text-primary border-primary bg-primary-container/10 font-medium"
                      : "text-text-muted hover:text-foreground hover:bg-surface-container border-transparent",
                  )}
                  onClick={() => setSidebarOpen(false)}
                >
                  <Icon className="h-5 w-5 shrink-0" />
                  <span className="truncate">{t(key)}</span>
                </Link>
              );
            })}
          </nav>
        </div>
      )}
    </>
  );
}

export function MobileNav() {
  const t = useTranslations("nav");
  const locale = useLocale();
  const pathname = usePathname();
  const mobileItems = navItems.slice(0, 4);

  return (
    <nav className="lg:hidden fixed bottom-0 left-0 w-full z-40 flex justify-around items-center px-4 py-2 pb-safe bg-surface-container border-t border-border-subtle rounded-t-xl shadow-lg">
      {mobileItems.map(({ key, href, icon: Icon }) => {
        const fullHref = `/${locale}${href}`;
        const active = pathname === fullHref;
        return (
          <Link
            key={key}
            href={fullHref}
            className={cn(
              "flex flex-col items-center justify-center rounded-xl px-3 py-1 transition-all w-16",
              active ? "text-primary bg-primary-container/20 scale-95" : "text-text-muted active:bg-surface-container-high",
            )}
          >
            <Icon className="text-xl mb-1 h-5 w-5" />
            <span className="text-[10px] font-semibold uppercase tracking-wide">{t(key)}</span>
          </Link>
        );
      })}
    </nav>
  );
}

export function SidebarToggle() {
  const { setSidebarOpen } = useUIStore();
  return (
    <Button variant="ghost" size="icon" className="h-8 w-8 lg:hidden" onClick={() => setSidebarOpen(true)}>
      <Menu className="h-4 w-4" />
    </Button>
  );
}
