"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations, useLocale } from "next-intl";
import {
  Home,
  Receipt,
  TrendingUp,
  Wallet,
  CreditCard,
  Lightbulb,
  Menu,
  X,
  Compass,
  Activity,
  Store,
  HeartPulse,
  Settings,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useUIStore } from "@/stores/ui-store";
import { Button } from "@/components/ui/button";

const navGroups = [
  {
    label: "COMMAND CENTER",
    items: [
      { key: "dashboard", href: "/home", icon: Home },
    ],
  },
  {
    label: "FINANCIAL INTELLIGENCE",
    items: [
      { key: "transactions", href: "/expenses", icon: Receipt },
      { key: "cashflow", href: "/cashflow", icon: TrendingUp },
      { key: "financialPlanning", href: "/budget", icon: Wallet },
    ],
  },
  {
    label: "BUSINESS FINANCE",
    items: [
      { key: "creditReadiness", href: "/readiness", icon: CreditCard },
      { key: "businessHealth", href: "/business", icon: HeartPulse },
      { key: "businessProfile", href: "/business", icon: Store },
    ],
  },
  {
    label: "AI",
    items: [
      { key: "finaiAdvisor", href: "/advisory", icon: Lightbulb },
    ],
  },
  {
    label: "ACCOUNT",
    items: [
      { key: "settings", href: "/settings", icon: Settings },
      { key: "profile", href: "/profile", icon: Compass },
    ],
  },
];

const allNavItems = navGroups.flatMap((g) => g.items as { key: string; href: string; icon: React.ElementType }[]);

function NavGroup({ group, locale, pathname, t }: {
  group: { label: string; items: readonly { key: string; href: string; icon: React.ElementType }[] };
  locale: string;
  pathname: string;
  t: ReturnType<typeof useTranslations>;
}) {
  return (
    <div>
      <p className="px-3 mb-1.5 text-[10px] font-bold uppercase tracking-[0.1em] text-text-muted/70 flex items-center gap-1.5">
        <span className="h-1 w-1 rounded-full bg-cyan-400/40 inline-block" />
        {group.label}
      </p>
      <div className="flex flex-col gap-0.5">
        {group.items.map((item) => {
          const fullHref = `/${locale}${item.href}`;
          const active = pathname === fullHref || pathname.startsWith(fullHref + "/");
          const Icon = item.icon;
          return (
            <Link
              key={item.key}
              href={fullHref}
              className={cn(
                "group relative flex items-center gap-2.5 px-3 py-2 text-[13px] rounded-lg transition-all duration-200",
                active
                  ? "bg-cyan-500/10 text-cyan-300 font-semibold border-l-2 border-cyan-400 shadow-[inset_0_0_12px_rgba(0,242,254,0.08)]"
                  : "text-text-secondary hover:text-text-primary hover:bg-white/[0.04] border-l-2 border-transparent",
              )}
            >
              <Icon
                className={cn(
                  "h-4 w-4 shrink-0 transition-transform duration-200 group-hover:scale-110",
                  active ? "text-cyan-400" : "text-text-muted group-hover:text-cyan-300"
                )}
                strokeWidth={active ? 2 : 1.5}
              />
              <span className="truncate">{t(item.key)}</span>
              {active && (
                <span className="ml-auto h-1.5 w-1.5 rounded-full bg-cyan-400 shadow-[0_0_6px_#00f2fe]" />
              )}
            </Link>
          );
        })}
      </div>
    </div>
  );
}

export function Sidebar() {
  const t = useTranslations("nav");
  const locale = useLocale();
  const pathname = usePathname();
  const { sidebarOpen, setSidebarOpen } = useUIStore();

  return (
    <>
      {/* Desktop futuristic sidebar */}
      <aside className="hidden lg:flex flex-col w-[260px] shrink-0 h-screen sticky top-0 bg-surface-card/85 backdrop-blur-2xl border-r border-cyan-500/15 z-30 shadow-[4px_0_24px_rgba(0,0,0,0.3)]">
        {/* Brand Header */}
        <div className="px-5 pt-5 pb-4 flex items-center gap-3 border-b border-border-subtle">
          <div className="relative w-9 h-9 rounded-xl bg-gradient-to-br from-cyan-500/20 to-indigo-500/20 border border-cyan-500/40 flex items-center justify-center shrink-0 shadow-[0_0_15px_rgba(0,242,254,0.2)]">
            <Compass className="h-5 w-5 text-cyan-400 animate-[spin_20s_linear_infinite]" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <h1 className="text-sm font-bold tracking-tight text-text-primary">FinCompass</h1>
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_#34d399]" />
            </div>
            <p className="text-[9px] font-mono font-medium uppercase tracking-[0.12em] text-cyan-400/80 mt-0.5">
              AI Command Center
            </p>
          </div>
        </div>

        {/* Navigation List */}
        <div className="flex-1 overflow-y-auto px-3 py-4 space-y-4">
          {navGroups.map((group) => (
            <NavGroup key={group.label} group={group} locale={locale} pathname={pathname} t={t} />
          ))}
        </div>

        {/* Telemetry Status Footer */}
        <div className="p-3 border-t border-border-subtle bg-surface-container/60">
          <div className="rounded-xl border border-cyan-500/20 bg-cyan-950/20 p-2.5 flex items-center justify-between">
            <div className="flex items-center gap-2 min-w-0">
              <Activity className="h-3.5 w-3.5 text-cyan-400 shrink-0" />
              <div className="min-w-0">
                <p className="text-[10px] font-mono uppercase text-cyan-300 font-semibold truncate">FINAI ONLINE</p>
                <p className="text-[9px] text-text-muted truncate">Realtime Advisory</p>
              </div>
            </div>
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400" />
            </span>
          </div>
        </div>
      </aside>

      {/* Mobile sidebar */}
      {sidebarOpen && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/70 backdrop-blur-md lg:hidden animate-fade-in"
            onClick={() => setSidebarOpen(false)}
            aria-hidden
          />
          <div className="fixed inset-y-0 left-0 z-50 flex w-[280px] flex-col bg-surface-card/95 backdrop-blur-2xl border-r border-cyan-500/20 lg:hidden animate-slide-in-right">
            <div className="px-5 py-4 flex items-center justify-between border-b border-border">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center">
                  <Compass className="h-4 w-4 text-cyan-400" />
                </div>
                <span className="text-sm font-bold text-text-primary tracking-tight">FinCompass</span>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-text-muted hover:text-cyan-400"
                onClick={() => setSidebarOpen(false)}
                aria-label="Close menu"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            <nav className="flex-1 overflow-y-auto px-3 py-3 space-y-3">
              {navGroups.map((group) => (
                <NavGroup
                  key={group.label}
                  group={group}
                  locale={locale}
                  pathname={pathname}
                  t={t}
                />
              ))}
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
  const preferred = ["/home", "/expenses", "/cashflow", "/budget", "/readiness", "/business", "/advisory", "/profile", "/settings"];
  const mobileItems = preferred
    .map((href) => allNavItems.find((item) => item.href === href))
    .filter((item): item is { key: string; href: string; icon: React.ElementType } => Boolean(item));

  return (
    <nav className="lg:hidden fixed bottom-0 left-0 w-full z-40 flex justify-around items-center px-2 py-2 pb-safe bg-surface-card/95 backdrop-blur-xl border-t border-cyan-500/20 shadow-[0_-8px_20px_rgba(0,0,0,0.4)]">
      {mobileItems.map(({ key, href, icon: Icon }) => {
        const fullHref = `/${locale}${href}`;
        const active = pathname === fullHref;
        return (
          <Link
            key={key}
            href={fullHref}
            className={cn(
              "mobile-nav-item flex flex-col items-center justify-center rounded-xl px-3 py-1.5 w-16 transition-all duration-200",
              active
                ? "text-cyan-400 bg-cyan-500/15 border border-cyan-500/30 shadow-[0_0_10px_rgba(0,242,254,0.15)]"
                : "text-text-muted hover:text-text-secondary",
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
    <Button
      variant="ghost"
      size="icon"
      className="h-9 w-9 lg:hidden text-cyan-400 hover:bg-cyan-500/10 border border-cyan-500/20"
      onClick={() => setSidebarOpen(true)}
      aria-label="Open menu"
    >
      <Menu className="h-4 w-4" />
    </Button>
  );
}
