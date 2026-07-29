"use client";

import { useTranslations } from "next-intl";
import { GameCtaButton } from "@/components/game-cta-button";
import type { CampaignActionState, CampaignRequirement } from "@/lib/campaign";

function translateRequirement(
  t: ReturnType<typeof useTranslations>,
  req: CampaignRequirement,
): string {
  const raw = req.descriptionParams ?? {};
  const params: Record<string, string | number> = { ...raw };
  for (const key of ["location", "stage"] as const) {
    const val = raw[key];
    if (typeof val === "string" && val.includes(".")) {
      params[key] = t(val);
    }
  }
  return t(req.descriptionKey, params);
}

/**
 * Bloque protagonista: dónde estoy / qué falta / qué botón pulso.
 * Un solo CTA — el resto de la pantalla no debe repetirlo.
 */
export function CampaignPrimaryObjective({
  action,
  gymHref,
}: {
  action: CampaignActionState;
  /** Si el challenge tiene gymId concreto, sustituye `/gyms`. */
  gymHref?: string | null;
}) {
  const t = useTranslations("campaign");
  const href =
    action.action === "challenge_gym" && gymHref ? gymHref : action.href;
  const gymReady = action.action === "challenge_gym";
  const showReqs = action.missingRequirements.length > 0;

  const title =
    action.locationNameKey != null
      ? t(action.objectiveTitleKey, { name: t(action.locationNameKey) })
      : t(action.objectiveTitleKey);

  return (
    <section
      className={`glass-panel rounded-xl border bg-gradient-to-br p-3.5 sm:p-4 ${
        gymReady
          ? "border-tertiary/45 from-tertiary/[0.12] to-transparent shadow-[0_0_28px_rgba(242,192,0,0.18)]"
          : "border-electric-yellow/25 from-electric-yellow/[0.07] to-transparent"
      }`}
    >
      <p
        className={`text-[10px] font-bold uppercase tracking-[0.2em] ${
          gymReady ? "text-tertiary" : "text-electric-yellow"
        }`}
      >
        {t("nextObjective")}
      </p>
      <h2 className="mt-1 text-headline-md tracking-tight text-white">{title}</h2>

      {action.progress && action.progress.target > 0 && (
        <div className="mt-3">
          <div className="mb-1 flex items-center justify-between gap-2 text-label-sm text-on-surface-variant">
            <span>{t("objectiveProgress")}</span>
            <span className="font-mono text-on-surface">
              {action.progress.current}/{action.progress.target}
            </span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full rounded-full bg-gradient-to-r from-[#ffcb05] to-[#ff8a00] transition-all duration-500 motion-reduce:transition-none"
              style={{
                width: `${Math.min(
                  100,
                  Math.round((action.progress.current / action.progress.target) * 100),
                )}%`,
              }}
            />
          </div>
        </div>
      )}

      {action.recommendedLevel != null && action.recommendedLevel > 0 && (
        <p className="mt-2 text-label-sm text-on-surface-variant">
          {t("reqLevel", { level: action.recommendedLevel })}
        </p>
      )}

      {showReqs && (
        <ul className="mt-3 flex flex-col gap-1.5">
          {action.missingRequirements.map((req) => (
            <li
              key={req.id}
              className={`flex items-start gap-2 text-label-sm ${
                req.completed ? "text-emerald-400" : "text-on-surface-variant"
              }`}
            >
              <span className="material-symbols-outlined mt-0.5 text-[16px]!">
                {req.completed ? "check_circle" : "radio_button_unchecked"}
              </span>
              <span>{translateRequirement(t, req)}</span>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-4 flex sm:justify-end">
        <div className="w-full sm:w-auto sm:min-w-[14rem]">
          <GameCtaButton href={href} disabled={!action.enabled}>
            {t(action.labelKey)}
          </GameCtaButton>
        </div>
      </div>
    </section>
  );
}
