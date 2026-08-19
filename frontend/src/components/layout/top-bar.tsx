"use client";

import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { Moon, Sun, Monitor, LogOut, Globe, Settings, Search } from "lucide-react";
import { useTheme } from "@/components/theme-provider";
import { ISTClock } from "@/components/common/ist-clock";
import { NotificationBell } from "@/components/layout/notification-bell";
import { SidebarToggle } from "@/components/layout/sidebar";
import { Button } from "@/components/ui/button";
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

  return (
    <header className="flex justify-between items-center h-16 px-4 md:px-12 w-full z-40 lg:pl-72 bg-background-page border-b border-border-subtle sticky top-0">
      <div className="flex items-center gap-4">
        <SidebarToggle />
        <div className="lg:hidden text-[24px] leading-[32px] font-semibold text-primary">FinCompass</div>
      </div>
      <div className="flex-1 max-w-md mx-8 hidden md:block relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted h-4 w-4" />
        <input
          className="w-full bg-surface-container-low border border-border-subtle rounded-lg pl-10 pr-4 py-2 text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all text-text-primary placeholder:text-text-muted"
          placeholder="Search transactions, goals..."
          type="text"
          readOnly
        />
      </div>
      <div className="flex items-center gap-4">
        <ISTClock />
        <Button variant="ghost" size="sm" className="h-8 px-2 text-xs hidden sm:flex" onClick={toggleLocale} aria-label="Switch language">
          <Globe className="h-3.5 w-3.5" />
          <span className="ml-1">{locale === "en" ? "हिंदी" : "EN"}</span>
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-on-surface-variant hover:text-primary"
          onClick={() => setTheme(theme === "dark" ? "light" : theme === "light" ? "system" : "dark")}
          aria-label="Toggle theme"
        >
          {theme === "dark" ? <Sun className="h-4 w-4" /> : theme === "light" ? <Moon className="h-4 w-4" /> : <Monitor className="h-4 w-4" />}
        </Button>
        <NotificationBell />
        <Button variant="ghost" size="icon" className="h-8 w-8 text-on-surface-variant hover:text-primary" aria-label={t("settings")}>
          <Settings className="h-4 w-4" />
        </Button>
        <div className="w-8 h-8 rounded-full bg-surface-bright overflow-hidden border border-border-subtle cursor-pointer flex items-center justify-center text-xs font-semibold text-primary" title={user?.full_name}>
          {initials}
        </div>
        <Button variant="ghost" size="icon" className="h-8 w-8 hidden sm:flex" onClick={handleLogout} aria-label={t("logout")}>
          <LogOut className="h-4 w-4" />
        </Button>
      </div>
    </header>
  );
}
