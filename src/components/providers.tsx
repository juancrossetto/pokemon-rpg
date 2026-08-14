"use client";

import { SessionProvider } from "next-auth/react";
import { OptimisticAvatarProvider } from "@/components/optimistic-avatar";
import { NavigationProgress } from "@/components/navigation-progress";
import { AppBootWarmup } from "@/components/app-boot-warmup";
import { WorldBgmController } from "@/components/world-bgm-controller";
import { GameSettingsRuntime } from "@/components/game-settings-runtime";
import { PwaUpdateManager } from "@/components/pwa-update-manager";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <OptimisticAvatarProvider>
        <NavigationProgress />
        <AppBootWarmup />
        <WorldBgmController />
        <GameSettingsRuntime />
        <PwaUpdateManager />
        {children}
      </OptimisticAvatarProvider>
    </SessionProvider>
  );
}
