"use client";

import { SessionProvider } from "next-auth/react";
import { OptimisticAvatarProvider } from "@/components/optimistic-avatar";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <OptimisticAvatarProvider>{children}</OptimisticAvatarProvider>
    </SessionProvider>
  );
}
