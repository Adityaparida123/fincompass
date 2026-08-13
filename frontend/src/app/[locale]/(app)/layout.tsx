"use client";

import { AuthGuard } from "@/components/auth/auth-guard";
import { Sidebar, MobileNav } from "@/components/layout/sidebar";
import { TopBar } from "@/components/layout/top-bar";
import { FinAIChat } from "@/components/chat/finai-chat";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard>
      <div className="flex min-h-screen">
        <Sidebar />
        <div className="flex flex-1 flex-col min-w-0">
          <TopBar />
          <main className="flex-1 overflow-y-auto p-4 pb-24 lg:p-6 lg:pb-6">
            {children}
          </main>
        </div>
        <MobileNav />
        <FinAIChat />
      </div>
    </AuthGuard>
  );
}
