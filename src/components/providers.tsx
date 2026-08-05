"use client";

import { SessionProvider } from "next-auth/react";
import { OptimisticAvatarProvider } from "@/components/optimistic-avatar";
import { NavigationProgress } from "@/components/navigation-progress";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <OptimisticAvatarProvider>
        <NavigationProgress />
        {children}
      </OptimisticAvatarProvider>
    </SessionProvider>
  );
}
