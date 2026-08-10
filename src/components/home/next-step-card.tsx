import Image from "next/image";
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
    <section className="relative overflow-hidden rounded-2xl border border-electric-yellow/35 bg-gradient-to-br from-electric-yellow/[0.14] via-[#12141c] to-[#0a0c12] p-3.5 shadow-[0_12px_36px_rgba(0,0,0,0.45)] sm:p-4">
      <span
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-electric-yellow/70 to-transparent"
      />
      <span
        aria-hidden
        className="pointer-events-none absolute -right-6 -top-8 h-28 w-28 rounded-full bg-electric-yellow/10 blur-2xl"
      />

      <div className="relative flex items-start gap-3">
        <span
          aria-hidden
          className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-electric-yellow/35 bg-black/35"
        >
          <Image
            src="/nav/adventure-icon.png"
            alt=""
            width={36}
            height={36}
            draggable={false}
            className="h-8 w-8 object-contain drop-shadow-[0_4px_10px_rgba(0,0,0,0.45)]"
            unoptimized
          />
        </span>
        <div className="min-w-0 flex-1">
          <p className="page-title text-[10px] tracking-[0.18em] text-electric-yellow">
            {t("eyebrow")}
          </p>
          <h2 className="page-title mt-0.5 text-[16px] leading-none tracking-tight text-white sm:text-[18px]">
            {t(step.titleKey)}
          </h2>
          <p className="mt-1.5 text-[12px] leading-snug text-white/65 sm:text-[13px]">
            {t(step.bodyKey)}
          </p>
        </div>
      </div>

      <div className="relative mt-3 flex items-stretch gap-2">
        <Link
          href={step.href}
          className="game-cta game-cta--red inline-flex min-h-11 flex-1 sm:min-h-12"
        >
          <span className="game-cta__label">{t(step.ctaKey)}</span>
        </Link>
        {step.secondary && (
          <Link
            href={step.secondary.href}
            className="game-cta game-cta--secondary inline-flex w-auto! min-h-11 shrink-0 gap-1.5! px-3! sm:min-h-12 sm:px-3.5!"
          >
            <span className="game-cta__label">{t(step.secondary.ctaKey)}</span>
          </Link>
        )}
      </div>
    </section>
  );
}
