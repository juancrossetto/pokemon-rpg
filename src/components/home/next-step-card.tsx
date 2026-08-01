import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import type { NextStep } from "@/lib/next-step";

/**
 * "Tu próximo paso" — la card que aparece cuando el hero de expedición deja de
 * ser la respuesta correcta.
 *
 * Se dibuja **solo** con `step.standalone`, que es `false` durante toda la
 * historia: mientras la aventura avanza, el hero ya es un CTA único y sumar
 * este panel arriba crearía dos llamados a la acción compitiendo, que es
 * exactamente el problema que este trabajo vino a resolver.
 *
 * Es un Server Component: no tiene estado y así el copy se resuelve del lado
 * del servidor sin mandar un diccionario más al bundle del cliente.
 */
export async function NextStepCard({ step }: { step: NextStep }) {
  if (!step.standalone) return null;
  const t = await getTranslations("nextStep");

  return (
    <section className="relative overflow-hidden rounded-2xl border border-electric-yellow/30 bg-gradient-to-br from-electric-yellow/[0.12] via-black/40 to-black/60 p-3.5 shadow-[0_12px_36px_rgba(0,0,0,0.45)] sm:p-4">
      <span
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-electric-yellow/70 to-transparent"
      />

      <div className="flex items-start gap-3">
        <span
          aria-hidden
          className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-electric-yellow/40 bg-electric-yellow/10 text-electric-yellow"
        >
          <span className="material-symbols-outlined text-[24px]!">{step.icon}</span>
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-electric-yellow">
            {t("eyebrow")}
          </p>
          <h2 className="mt-0.5 text-[17px] font-semibold leading-tight tracking-tight text-white sm:text-[19px]">
            {t(step.titleKey)}
          </h2>
          <p className="mt-1 text-[12px] leading-snug text-white/65 sm:text-[13px]">
            {t(step.bodyKey)}
          </p>
        </div>
      </div>

      <div className="mt-3 flex items-stretch gap-2">
        <Link
          href={step.href}
          className="inline-flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-xl bg-pokeball-red px-4 text-[13px] font-bold uppercase tracking-wide text-white transition hover:bg-pokeball-red/85 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50 sm:min-h-12"
        >
          {t(step.ctaKey)}
        </Link>
        {step.secondary && (
          <Link
            href={step.secondary.href}
            className="inline-flex min-h-11 shrink-0 items-center justify-center gap-1.5 rounded-xl border border-white/20 bg-black/40 px-3.5 text-[13px] font-medium text-on-surface transition hover:bg-white/10 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40 sm:min-h-12"
          >
            <span aria-hidden className="material-symbols-outlined text-[18px]!">
              {step.secondary.icon}
            </span>
            {t(step.secondary.ctaKey)}
          </Link>
        )}
      </div>
    </section>
  );
}
