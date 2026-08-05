"use client";

import { SessionProvider } from "next-auth/react";
import { OptimisticAvatarProvider } from "@/components/optimistic-avatar";
import { NavigationProgress } from "@/components/navigation-progress";
import { AppBootWarmup } from "@/components/app-boot-warmup";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <OptimisticAvatarProvider>
        <NavigationProgress />
        <AppBootWarmup />
        {children}
      </OptimisticAvatarProvider>
    </SessionProvider>
  );
}
