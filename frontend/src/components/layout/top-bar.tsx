"use client";

import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { Moon, Sun, Monitor, LogOut, Globe } from "lucide-react";
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

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b bg-card/80 px-4 backdrop-blur supports-[backdrop-filter]:bg-card/60">
      <SidebarToggle />
      <div className="flex-1" />
      <ISTClock />
      <Button variant="ghost" size="sm" className="h-8 px-2 text-xs" onClick={toggleLocale} aria-label="Switch language">
        <Globe className="h-3.5 w-3.5" />
        <span className="ml-1 hidden sm:inline">{locale === "en" ? "हिंदी" : "EN"}</span>
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8"
        onClick={() => setTheme(theme === "dark" ? "light" : theme === "light" ? "system" : "dark")}
        aria-label="Toggle theme"
      >
        {theme === "dark" ? <Sun className="h-3.5 w-3.5" /> : theme === "light" ? <Moon className="h-3.5 w-3.5" /> : <Monitor className="h-3.5 w-3.5" />}
      </Button>
      <NotificationBell />
      <div className="hidden sm:block text-xs text-muted-foreground truncate max-w-[8rem]">
        {user?.full_name}
      </div>
      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleLogout} aria-label={t("logout")}>
        <LogOut className="h-3.5 w-3.5" />
      </Button>
    </header>
  );
}
