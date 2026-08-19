"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useLocale } from "next-intl";
import { useAuthStore } from "@/stores/auth-store";
import { Skeleton } from "@/components/ui/input";
import { api } from "@/lib/api";

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isHydrated } = useAuthStore();
  const router = useRouter();
  const locale = useLocale();

  useEffect(() => {
    if (isHydrated && !isAuthenticated) {
      router.replace(`/${locale}/login`);
    }
  }, [isHydrated, isAuthenticated, router, locale]);

  if (!isHydrated) {
    return (
      <div className="flex min-h-screen items-center justify-center p-8">
        <div className="w-full max-w-md space-y-4">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-32 w-full" />
        </div>
      </div>
    );
  }

  if (!isAuthenticated) return null;
  return <>{children}</>;
}

export function GuestGuard({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isHydrated } = useAuthStore();
  const router = useRouter();
  const locale = useLocale();
  const [verifying, setVerifying] = useState(false);
  const verifyingRef = useRef(false);

  useEffect(() => {
    if (!isHydrated || !isAuthenticated || verifyingRef.current) return;
    verifyingRef.current = true;
    setVerifying(true);
    api.verifySession().then((valid) => {
      if (valid) {
        router.replace(`/${locale}/dashboard`);
      } else {
        useAuthStore.getState().clearAuth();
      }
      setVerifying(false);
    });
  }, [isHydrated, isAuthenticated, router, locale]);

  if (!isHydrated || verifying) return null;
  if (isAuthenticated) return null;
  return <>{children}</>;
}
