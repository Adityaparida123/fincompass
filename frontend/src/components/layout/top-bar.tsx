"use client";

import { usePathname, useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { Moon, Sun, Monitor, LogOut, Globe, Settings, Sparkles, Terminal } from "lucide-react";
import { useTheme } from "@/components/theme-provider";
import { ISTClock } from "@/components/common/ist-clock";
import { NotificationBell } from "@/components/layout/notification-bell";
import { SidebarToggle } from "@/components/layout/sidebar";
import { useAuthStore } from "@/stores/auth-store";
import { useChatStore } from "@/stores/chat-store";

export function TopBar() {
  const t = useTranslations("common");
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const { user, logout } = useAuthStore();
  const { setOpen: setChatOpen } = useChatStore();

  const toggleLocale = () => {
    const next = locale === "en" ? "hi" : "en";
    router.push(pathname.replace(`/${locale}`, `/${next}`));
  };

  const handleLogout = async () => {
    await logout();
    router.push(`/${locale}/login`);
  };

  const initials = user?.full_name
    ? user.full_name.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2)
    : "U";

  const goToSettings = () => router.push(`/${locale}/settings`);

  return (
    <header className="flex justify-between items-center h-14 px-4 md:px-6 w-full z-40 bg-surface-card/75 backdrop-blur-2xl border-b border-cyan-500/15 sticky top-0 shadow-[0_4px_20px_rgba(0,0,0,0.25)]">
      <div className="flex items-center gap-3 min-w-0">
        <SidebarToggle />
        <div className="lg:hidden text-sm font-bold text-cyan-400 tracking-tight truncate flex items-center gap-1.5">
          <span>FinCompass</span>
          <span className="h-1.5 w-1.5 rounded-full bg-cyan-400" />
        </div>

        {/* Quick FinAI Command Prompt Shortcut */}
        <button
          onClick={() => setChatOpen(true)}
          className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-xl border border-cyan-500/25 bg-cyan-500/10 text-cyan-300 hover:bg-cyan-500/20 hover:border-cyan-400/40 text-xs font-mono transition-all duration-200 shadow-[0_0_12px_rgba(0,242,254,0.08)] cursor-pointer"
        >
          <Sparkles className="h-3.5 w-3.5 text-cyan-400 animate-pulse" />
          <span className="text-[11px] font-semibold tracking-wide">ASK FINAI</span>
          <kbd className="px-1.5 py-0.5 rounded bg-black/40 text-[9px] text-cyan-400/80 border border-cyan-500/20">
            Ctrl+K
          </kbd>
        </button>
      </div>

      <div className="flex items-center gap-1.5">
        <ISTClock className="hidden sm:block" />

        {/* Locale switch */}
        <button
          className="topbar-icon hidden sm:flex items-center gap-1 h-8 px-2.5 rounded-lg text-xs font-medium text-text-secondary hover:text-cyan-300 hover:bg-cyan-500/10 border border-transparent hover:border-cyan-500/20 transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/50"
          onClick={toggleLocale}
          aria-label="Switch language"
        >
          <Globe className="h-3.5 w-3.5 text-cyan-400" />
          <span className="ml-1 font-mono text-[11px]">{locale === "en" ? "HI" : "EN"}</span>
        </button>

        {/* Theme switch */}
        <button
          className="topbar-icon h-8 w-8 flex items-center justify-center rounded-lg text-text-secondary hover:text-cyan-300 hover:bg-cyan-500/10 border border-transparent hover:border-cyan-500/20 transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/50"
          onClick={() => setTheme(theme === "dark" ? "light" : theme === "light" ? "system" : "dark")}
          aria-label="Toggle theme"
        >
          {theme === "dark" ? <Sun className="h-4 w-4 text-amber-400" /> : theme === "light" ? <Moon className="h-4 w-4 text-cyan-400" /> : <Monitor className="h-4 w-4" />}
        </button>

        <NotificationBell />

        {/* Settings */}
        <button
          className="topbar-icon h-8 w-8 flex items-center justify-center rounded-lg text-text-secondary hover:text-cyan-300 hover:bg-cyan-500/10 border border-transparent hover:border-cyan-500/20 transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/50"
          onClick={goToSettings}
          aria-label={t("settings")}
        >
          <Settings className="h-4 w-4" />
        </button>

        {/* User profile avatar */}
        <button
          className="h-8 w-8 rounded-xl bg-gradient-to-br from-cyan-500/20 to-indigo-500/20 border border-cyan-500/35 flex items-center justify-center text-[11px] font-mono font-bold text-cyan-300 hover:border-cyan-400 hover:shadow-[0_0_15px_rgba(0,242,254,0.25)] transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/50 cursor-pointer ml-1"
          onClick={goToSettings}
          title={user?.full_name ?? "Settings"}
          aria-label="Settings"
        >
          {initials}
        </button>

        {/* Logout */}
        <button
          className="topbar-icon h-8 w-8 hidden sm:flex items-center justify-center rounded-lg text-text-secondary hover:text-rose-400 hover:bg-rose-500/10 border border-transparent hover:border-rose-500/20 transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400/50 ml-1"
          onClick={handleLogout}
          aria-label={t("logout")}
        >
          <LogOut className="h-4 w-4" />
        </button>
      </div>
    </header>
  );
}
