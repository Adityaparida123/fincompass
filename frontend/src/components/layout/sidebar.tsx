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
          "fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r bg-card transition-transform duration-200 lg:static lg:translate-x-0",
          sidebarOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex h-14 items-center gap-2 border-b px-4">
          <Compass className="h-5 w-5 text-primary" />
          <span className="text-base font-semibold tracking-tight">FinCompass</span>
          <Button variant="ghost" size="icon" className="ml-auto h-8 w-8 lg:hidden" onClick={() => setSidebarOpen(false)}>
            <X className="h-4 w-4" />
          </Button>
        </div>
        <nav className="flex-1 overflow-y-auto p-2">
          <ul className="space-y-0.5">
            {navItems.map(({ key, href, icon: Icon }) => {
              const fullHref = `/${locale}${href}`;
              const active = pathname === fullHref || pathname.startsWith(fullHref + "/");
              return (
                <li key={key}>
                  <Link
                    href={fullHref}
                    className={cn(
                      "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                      active
                        ? "bg-primary/10 text-primary"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground",
                    )}
                    onClick={() => setSidebarOpen(false)}
                  >
                    <Icon className="h-4 w-4 shrink-0" strokeWidth={active ? 2.2 : 1.8} />
                    <span className="truncate">{t(key)}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      </aside>
    </>
  );
}

export function MobileNav() {
  const t = useTranslations("nav");
  const locale = useLocale();
  const pathname = usePathname();
  const mobileItems = navItems.slice(0, 5);

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t bg-card/95 backdrop-blur lg:hidden">
      <ul className="grid grid-cols-5">
        {mobileItems.map(({ key, href, icon: Icon }) => {
          const fullHref = `/${locale}${href}`;
          const active = pathname === fullHref;
          return (
            <li key={key}>
              <Link
                href={fullHref}
                className={cn(
                  "flex flex-col items-center gap-0.5 py-2.5 text-[10px] font-medium transition-colors",
                  active ? "text-primary" : "text-muted-foreground",
                )}
              >
                <Icon className="h-5 w-5" strokeWidth={active ? 2.2 : 1.8} />
                <span className="truncate max-w-[4rem]">{t(key)}</span>
              </Link>
            </li>
          );
        })}
      </ul>
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
