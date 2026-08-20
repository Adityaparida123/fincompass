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
      {/* Desktop sidebar */}
      <aside
        className={cn(
          "hidden lg:flex flex-col w-[260px] shrink-0 h-screen sticky top-0 bg-surface-card border-r border-border-subtle z-30",
        )}
      >
        <div className="px-4 pt-5 pb-3 flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center border border-primary/20 shrink-0">
            <Compass className="h-4 w-4 text-primary" />
          </div>
          <div className="min-w-0">
            <h1 className="text-sm font-semibold text-primary tracking-tight leading-tight">FinCompass</h1>
            <p className="text-[10px] leading-[12px] font-medium uppercase tracking-[0.1em] text-text-muted mt-0.5">Wealth Management</p>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-2.5 pb-4">
          <div className="flex flex-col gap-px">
            {navItems.map(({ key, href, icon: Icon }) => {
              const fullHref = `/${locale}${href}`;
              const active = pathname === fullHref || pathname.startsWith(fullHref + "/");
              return (
                <Link
                  key={key}
                  href={fullHref}
                  className={cn(
                    "flex items-center gap-2.5 px-3 py-[7px] text-[13px] rounded-lg transition-all duration-150",
                    active
                      ? "text-primary bg-primary/10 font-medium"
                      : "text-text-muted hover:text-foreground hover:bg-surface-container-high",
                  )}
                >
                  <Icon className="h-[18px] w-[18px] shrink-0" strokeWidth={active ? 2 : 1.5} />
                  <span className="truncate">{t(key)}</span>
                </Link>
              );
            })}
          </div>
        </div>
      </aside>

      {/* Mobile sidebar */}
      {sidebarOpen && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm lg:hidden"
            onClick={() => setSidebarOpen(false)}
            aria-hidden
          />
          <div className="fixed inset-y-0 left-0 z-50 flex w-[280px] flex-col bg-surface-card border-r border-border-subtle lg:hidden animate-slide-in-right">
            <div className="px-5 py-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center border border-primary/20">
                  <Compass className="h-4 w-4 text-primary" />
                </div>
                <span className="text-base font-semibold text-primary tracking-tight">FinCompass</span>
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
                        "flex items-center gap-3 px-3 py-2 text-[13px] rounded-lg transition-all duration-200",
                        active
                          ? "text-primary bg-primary/10 font-medium border border-primary/15"
                          : "text-text-muted hover:text-foreground hover:bg-surface-container-high",
                      )}
                      onClick={() => setSidebarOpen(false)}
                    >
                      <Icon className="h-4 w-4 shrink-0" strokeWidth={active ? 2 : 1.5} />
                      <span className="truncate">{t(key)}</span>
                    </Link>
                  );
                })}
              </div>
            </nav>
          </div>
        </>
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
              "flex flex-col items-center justify-center rounded-lg px-3 py-1.5 transition-all w-16",
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
    <Button variant="ghost" size="icon" className="h-9 w-9 lg:hidden" onClick={() => setSidebarOpen(true)}>
      <Menu className="h-4 w-4" />
    </Button>
  );
}
