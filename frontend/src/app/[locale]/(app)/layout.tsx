"use client";

import { AuthGuard } from "@/components/auth/auth-guard";
import { Sidebar, MobileNav } from "@/components/layout/sidebar";
import { TopBar } from "@/components/layout/top-bar";
import { FinAIChat } from "@/components/chat/finai-chat";
import { AnimatedLogoWatermark } from "@/components/animated-logo-watermark";
import { FinancialParticles } from "@/components/3d/financial-particles";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard>
      <div className="relative isolate flex min-h-screen bg-background-page spatial-grid-bg text-foreground overflow-x-hidden">
        <FinancialParticles className="z-0 opacity-40 fixed inset-0" />
        <AnimatedLogoWatermark />
        <Sidebar />
        <div className="flex flex-1 flex-col min-w-0 z-10">
          <TopBar />
          <main className="relative z-10 flex-1 overflow-y-auto pt-6 px-4 md:px-6 lg:px-8 pb-8 lg:pb-8 min-h-screen">
            <div className="page-transition max-w-[1600px] mx-auto w-full">{children}</div>
          </main>
        </div>
        <MobileNav />
        <FinAIChat />
      </div>
    </AuthGuard>
  );
}
