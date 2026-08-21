"use client";

import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { Moon, Sun, Monitor, LogOut, Globe, Settings, Search } from "lucide-react";
import { useTheme } from "@/components/theme-provider";
import { ISTClock } from "@/components/common/ist-clock";
import { NotificationBell } from "@/components/layout/notification-bell";
import { SidebarToggle } from "@/components/layout/sidebar";
import { useAuthStore } from "@/stores/auth-store";

export function TopBar() {
  const t = useTranslations("common");
  const locale = useLocale();
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const { user, logout } = useAuthStore();

  const toggleLocale = () => {
    const next = locale === "en" ? "hi" : "en";
    const path = window.location.pathname.replace(`/${locale}`, `/${next}`);
    router.push(path);
  };

  const handleLogout = async () => {
    await logout();
    router.push(`/${locale}/login`);
  };

  const initials = user?.full_name
    ? user.full_name.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2)
    : "U";

  const goToProfile = () => router.push(`/${locale}/profile`);
  const goToSettings = () => router.push(`/${locale}/settings`);

  return (
    <header className="flex justify-between items-center h-12 px-4 md:px-6 w-full z-40 bg-background-page/80 backdrop-blur-xl border-b border-border sticky top-0">
      <div className="flex items-center gap-3 min-w-0">
        <SidebarToggle />
        <div className="lg:hidden text-sm font-semibold text-primary tracking-tight truncate">FinCompass</div>
      </div>
      <div className="flex-1 max-w-sm mx-4 hidden md:block relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted h-3.5 w-3.5" />
        <input
          className="w-full bg-surface-container-low border border-border rounded-lg pl-9 pr-3 py-1.5 text-sm text-text-primary placeholder:text-text-muted input-premium focus:outline-none"
          placeholder="Search..."
          type="text"
          readOnly
        />
      </div>
      <div className="flex items-center gap-1">
        <ISTClock className="hidden sm:block" />
        <button
          className="topbar-icon hidden sm:flex items-center gap-1 h-8 px-2 rounded-lg text-xs text-on-surface-variant hover:text-primary hover:bg-surface-container transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
          onClick={toggleLocale}
          aria-label="Switch language"
        >
          <Globe className="h-3.5 w-3.5" />
          <span className="ml-1">{locale === "en" ? "हिंदी" : "EN"}</span>
        </button>
        <button
          className="topbar-icon h-8 w-8 flex items-center justify-center rounded-lg text-on-surface-variant hover:text-primary hover:bg-surface-container transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
          onClick={() => setTheme(theme === "dark" ? "light" : theme === "light" ? "system" : "dark")}
          aria-label="Toggle theme"
        >
          {theme === "dark" ? <Sun className="h-4 w-4" /> : theme === "light" ? <Moon className="h-4 w-4" /> : <Monitor className="h-4 w-4" />}
        </button>
        <NotificationBell />
        <button
          className="topbar-icon h-8 w-8 flex items-center justify-center rounded-lg text-on-surface-variant hover:text-primary hover:bg-surface-container transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
          onClick={goToSettings}
          aria-label={t("settings")}
        >
          <Settings className="h-4 w-4" />
        </button>
        <button
          className="h-7 w-7 rounded-full bg-primary/15 border border-primary/25 flex items-center justify-center text-[10px] font-semibold text-primary hover:bg-primary/25 hover:border-primary/40 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 cursor-pointer"
          onClick={goToProfile}
          title={user?.full_name ?? "Profile"}
          aria-label="Profile"
        >
          {initials}
        </button>
        <button
          className="topbar-icon h-8 w-8 hidden sm:flex items-center justify-center rounded-lg text-on-surface-variant hover:text-destructive hover:bg-surface-container transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
          onClick={handleLogout}
          aria-label={t("logout")}
        >
          <LogOut className="h-4 w-4" />
        </button>
      </div>
    </header>
  );
}
