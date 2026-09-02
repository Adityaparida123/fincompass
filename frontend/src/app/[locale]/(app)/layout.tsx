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
      <div className="relative isolate flex h-dvh overflow-hidden bg-background-page spatial-grid-bg text-foreground">
        <FinancialParticles className="z-0 opacity-40 fixed inset-0" />
        <AnimatedLogoWatermark />
        <Sidebar />
        <div className="z-10 flex min-w-0 flex-1 flex-col">
          <TopBar />
          <main className="relative z-10 min-h-0 flex-1 overflow-y-auto px-4 pb-8 pt-6 md:px-6 lg:px-8">
            <div className="page-transition max-w-[1600px] mx-auto w-full">{children}</div>
          </main>
        </div>
        <MobileNav />
        <FinAIChat />
      </div>
    </AuthGuard>
  );
}
