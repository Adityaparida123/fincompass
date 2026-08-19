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
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm lg:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-hidden
        />
      )}
      <aside
        className={cn(
          "hidden lg:flex flex-col h-screen w-[260px] fixed left-0 top-0 bg-surface-card border-r border-border-subtle z-50 transition-transform duration-200",
          sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0",
        )}
      >
        <div className="px-5 pt-6 pb-5 flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center border border-primary/20">
            <Compass className="h-[18px] w-[18px] text-primary" />
          </div>
          <div>
            <h1 className="text-[17px] leading-[22px] font-semibold text-primary tracking-tight">FinCompass</h1>
            <p className="text-[10px] leading-[14px] font-medium uppercase tracking-[0.08em] text-text-muted mt-0.5">Wealth Management</p>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-3 pb-4">
          <div className="flex flex-col gap-0.5">
            {navItems.map(({ key, href, icon: Icon }) => {
              const fullHref = `/${locale}${href}`;
              const active = pathname === fullHref || pathname.startsWith(fullHref + "/");
              return (
                <Link
                  key={key}
                  href={fullHref}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2 text-[13px] leading-[18px] rounded-lg transition-all duration-150",
                    active
                      ? "text-primary bg-primary/10 font-medium"
                      : "text-text-muted hover:text-foreground hover:bg-surface-container-high/60",
                  )}
                  onClick={() => setSidebarOpen(false)}
                >
                  <Icon className="h-[18px] w-[18px] shrink-0" strokeWidth={active ? 2 : 1.5} />
                  <span className="truncate">{t(key)}</span>
                </Link>
              );
            })}
          </div>
        </div>

        <div className="mt-auto px-3 pb-4">
          <div className="rounded-xl p-3.5 text-center bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/15">
            <p className="text-[12px] leading-[16px] text-text-muted mb-2.5">Unlock advanced analytics.</p>
            <button className="w-full bg-primary text-on-primary-container font-medium py-2 rounded-lg glow-hover transition-all text-[13px] hover:bg-primary/90">
              Upgrade to Pro
            </button>
          </div>
        </div>
      </aside>

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div className="fixed inset-y-0 left-0 z-50 flex w-[280px] flex-col bg-surface-card border-r border-border-subtle lg:hidden">
          <div className="px-5 py-5 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center border border-primary/20">
                <Compass className="h-[18px] w-[18px] text-primary" />
              </div>
              <span className="text-[17px] leading-[22px] font-semibold text-primary tracking-tight">FinCompass</span>
            </div>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setSidebarOpen(false)}>
              <X className="h-4 w-4" />
            </Button>
          </div>
          <nav className="flex-1 overflow-y-auto px-3 pb-4">
            <div className="flex flex-col gap-0.5">
              {navItems.map(({ key, href, icon: Icon }) => {
                const fullHref = `/${locale}${href}`;
                const active = pathname === fullHref || pathname.startsWith(fullHref + "/");
                return (
                  <Link
                    key={key}
                    href={fullHref}
                    className={cn(
                      "flex items-center gap-3 px-3 py-2.5 text-[13px] leading-[18px] rounded-lg transition-all duration-150",
                      active
                        ? "text-primary bg-primary/10 font-medium"
                        : "text-text-muted hover:text-foreground hover:bg-surface-container-high/60",
                    )}
                    onClick={() => setSidebarOpen(false)}
                  >
                    <Icon className="h-[18px] w-[18px] shrink-0" strokeWidth={active ? 2 : 1.5} />
                    <span className="truncate">{t(key)}</span>
                  </Link>
                );
              })}
            </div>
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
    <nav className="lg:hidden fixed bottom-0 left-0 w-full z-40 flex justify-around items-center px-2 py-1.5 pb-safe bg-surface-card/95 backdrop-blur-lg border-t border-border-subtle rounded-t-xl shadow-lg">
      {mobileItems.map(({ key, href, icon: Icon }) => {
        const fullHref = `/${locale}${href}`;
        const active = pathname === fullHref;
        return (
          <Link
            key={key}
            href={fullHref}
            className={cn(
              "flex flex-col items-center justify-center rounded-xl px-3 py-1.5 transition-all w-16",
              active ? "text-primary bg-primary/10" : "text-text-muted active:bg-surface-container-high",
            )}
          >
            <Icon className="h-5 w-5 mb-0.5" strokeWidth={active ? 2 : 1.5} />
            <span className="text-[9px] font-semibold uppercase tracking-wider">{t(key)}</span>
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
