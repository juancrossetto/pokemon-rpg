"use client";

import { useTranslations } from "next-intl";

// Panel decorativo del registro — diseño propio inspirado en el mockup
// (que traía una imagen genérica tipo stock), no una réplica de esa imagen.
export function BiometricScanPanel() {
  const t = useTranslations("auth.register");

  return (
    <div className="flex flex-col h-full p-6 lg:p-8">
      <div className="flex items-center gap-2 pb-3 border-b border-white/10 text-on-surface-variant">
        <span className="material-symbols-outlined text-[18px]! shrink-0">memory</span>
        <span className="text-label-sm text-[10px] font-mono uppercase tracking-widest min-w-0 truncate">
          {t("leftEyebrow")}
        </span>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center gap-6 py-8">
        <div className="relative w-44 h-44 rounded-lg border-2 border-secondary/60 bg-surface-container-lowest/80 overflow-hidden">
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="material-symbols-outlined text-[96px]! text-secondary/50 scan-pulse">face</span>
          </div>
          <div className="absolute left-0 right-0 h-[2px] bg-pokeball-red shadow-[0_0_10px_2px_rgba(238,21,21,0.8)] scan-line" />
          <span className="absolute top-1 left-1 w-3 h-3 border-t-2 border-l-2 border-secondary" />
          <span className="absolute top-1 right-1 w-3 h-3 border-t-2 border-r-2 border-secondary" />
          <span className="absolute bottom-1 left-1 w-3 h-3 border-b-2 border-l-2 border-secondary" />
          <span className="absolute bottom-1 right-1 w-3 h-3 border-b-2 border-r-2 border-secondary" />
        </div>

        <p className="text-label-sm font-mono text-secondary scan-pulse text-center">{t("scanStatus")}</p>

        <div className="border border-pokeball-red/50 bg-pokeball-red/10 rounded-lg px-4 py-3 text-center max-w-[240px]">
          <p className="text-label-sm text-pokeball-red font-bold uppercase tracking-wide">
            {t("biometricTitle")}
          </p>
          <p className="text-label-sm text-pokeball-red/70 text-[10px] mt-1 uppercase">
            {t("biometricSubtitle")}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 pt-3 border-t border-white/10 text-on-surface-variant/60 text-label-sm text-[10px] font-mono">
        <span className="min-w-0 truncate">{t("labSysVer")}</span>
        <span className="min-w-0 truncate">{t("secLvl")}</span>
      </div>
    </div>
  );
}
