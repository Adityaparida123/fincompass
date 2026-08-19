"use client";

import { AuthGuard } from "@/components/auth/auth-guard";
import { Sidebar, MobileNav } from "@/components/layout/sidebar";
import { TopBar } from "@/components/layout/top-bar";
import { FinAIChat } from "@/components/chat/finai-chat";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard>
      <div className="flex min-h-screen bg-background-page">
        <Sidebar />
        <div className="flex flex-1 flex-col min-w-0">
          <TopBar />
          <main className="flex-1 overflow-y-auto pt-8 px-4 md:px-12 pb-24 lg:pb-12 min-h-screen">
            {children}
          </main>
        </div>
        <MobileNav />
        <FinAIChat />
      </div>
    </AuthGuard>
  );
}
