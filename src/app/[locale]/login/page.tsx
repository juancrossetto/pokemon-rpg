"use client";

import { useState, type FormEvent } from "react";
import { signIn } from "next-auth/react";
import { useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/navigation";
import { PokeballIcon } from "@/components/pokeball-icon";
import { BrandLogo } from "@/components/brand-logo";
import { AuthBackdrop } from "@/components/auth-backdrop";
import { LegalDisclaimer } from "@/components/legal-disclaimer";
import { markBootSplashPending } from "@/lib/boot-splash";

export default function LoginPage() {
  const t = useTranslations("auth.login");
  const tNav = useTranslations("nav");
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(false);

    const result = await signIn("credentials", {
      email,
      password,
      remember: remember ? "true" : "false",
      redirect: false,
    });

    setSubmitting(false);
    if (result?.error) {
      setError(true);
      return;
    }
    markBootSplashPending();
    router.push("/");
    router.refresh();
  }

  const fieldClass =
    "auth-field w-full rounded-lg border border-white/8 bg-white/[0.035] py-2.5 pl-10 pr-3 text-[15px] text-white outline-none transition placeholder:text-white/30 focus:border-[color-mix(in_srgb,var(--theme-primary)_45%,transparent)] focus:bg-white/[0.055] focus:shadow-[0_0_0_3px_color-mix(in_srgb,var(--theme-primary)_14%,transparent)]";

  return (
    <div className="relative isolate flex min-h-[calc(100dvh-3rem)] flex-1 flex-col md:min-h-[calc(100dvh-4rem)]">
      <AuthBackdrop />

      <div className="relative z-10 flex min-h-0 flex-1 flex-col px-4 sm:px-6">
        <div className="auth-login-rise mx-auto flex w-full max-w-[360px] flex-1 flex-col md:max-w-[380px]">
          <div className="shrink-0 pt-4 text-center md:pt-5">
            <BrandLogo
              alt={tNav("brand")}
              priority
              sizes="140px"
              className="mx-auto h-auto w-[118px] drop-shadow-[0_2px_14px_rgba(0,0,0,0.55)] sm:w-[132px]"
            />
            <p className="mt-1.5 text-[9px] font-medium uppercase tracking-[0.32em] text-white/38">
              {t("tagline")}
            </p>
          </div>

          <div className="flex min-h-0 flex-1 flex-col items-center justify-center py-3 md:py-4">
            <form onSubmit={handleSubmit} className="w-full">
              <div className="auth-login-panel relative overflow-hidden rounded-2xl">
                <div
                  aria-hidden
                  className="pointer-events-none absolute inset-x-6 top-0 h-px bg-linear-to-r from-transparent via-[color-mix(in_srgb,var(--theme-primary)_55%,transparent)] to-transparent"
                />

                <header className="relative px-5 pb-0 pt-5 text-center sm:px-5">
                  <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.22em] text-[color-mix(in_srgb,var(--theme-primary-bright)_88%,white)]">
                    {t("title")}
                  </p>
                  <h1 className="page-title whitespace-nowrap text-[clamp(0.98rem,3.8vw,1.28rem)] tracking-[0.02em] text-white">
                    {t("welcomeTitle")}
                  </h1>
                  <p className="mt-1.5 text-[12.5px] leading-snug text-white/48">
                    {t("welcomeSubtitle")}
                  </p>
                </header>

                <div className="relative space-y-2.5 px-5 py-4 sm:px-5">
                  <label className="block">
                    <span className="sr-only">{t("email")}</span>
                    <div className="relative">
                      <span className="material-symbols-outlined pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[17px]! text-white/35">
                        mail
                      </span>
                      <input
                        type="email"
                        required
                        autoComplete="email"
                        placeholder={t("email")}
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className={fieldClass}
                      />
                    </div>
                  </label>

                  <label className="block">
                    <span className="sr-only">{t("password")}</span>
                    <div className="relative">
                      <span className="material-symbols-outlined pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[17px]! text-white/35">
                        lock
                      </span>
                      <input
                        type={showPassword ? "text" : "password"}
                        required
                        autoComplete="current-password"
                        placeholder={t("password")}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className={`${fieldClass} pr-10`}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((v) => !v)}
                        aria-label={showPassword ? t("hidePassword") : t("showPassword")}
                        className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-white/35 transition hover:bg-white/6 hover:text-white/75"
                      >
                        <span className="material-symbols-outlined text-[17px]!">
                          {showPassword ? "visibility_off" : "visibility"}
                        </span>
                      </button>
                    </div>
                  </label>

                  <label className="flex cursor-pointer items-center justify-between gap-3 py-0.5 text-[12.5px] text-white/55">
                    <span>{t("rememberMe")}</span>
                    <span className="auth-switch relative inline-flex h-5 w-9 shrink-0 items-center">
                      <input
                        type="checkbox"
                        checked={remember}
                        onChange={(e) => setRemember(e.target.checked)}
                        className="peer sr-only"
                      />
                      <span
                        aria-hidden
                        className="absolute inset-0 rounded-full border border-white/12 bg-white/8 transition peer-checked:border-[color-mix(in_srgb,var(--theme-primary)_50%,transparent)] peer-checked:bg-[color-mix(in_srgb,var(--theme-primary)_38%,transparent)] peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-[color-mix(in_srgb,var(--theme-primary)_55%,transparent)]"
                      />
                      <span
                        aria-hidden
                        className="absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white/70 shadow-sm transition peer-checked:translate-x-4 peer-checked:bg-white"
                      />
                    </span>
                  </label>

                  {error ? (
                    <p
                      role="alert"
                      className="rounded-lg border border-error/25 bg-error/10 px-3 py-2 text-center text-[12.5px] text-error"
                    >
                      {t("error")}
                    </p>
                  ) : null}

                  <button
                    type="submit"
                    disabled={submitting}
                    className={`game-cta game-cta--red mt-0.5! min-h-11!${submitting ? " game-cta--disabled" : ""}`}
                  >
                    <PokeballIcon className="h-4 w-4 shrink-0" />
                    <span className="game-cta__label">
                      {submitting ? t("submitting") : t("submit")}
                    </span>
                  </button>

                  <p className="pt-0.5 text-center text-[12.5px] text-white/42">
                    {t("noAccount")}{" "}
                    <Link
                      href="/register"
                      className="font-semibold text-white/78 underline-offset-2 transition hover:text-white hover:underline"
                    >
                      {t("registerLinkHere")}
                    </Link>
                  </p>
                </div>
              </div>
            </form>
          </div>

          <LegalDisclaimer className="relative z-10 mx-auto max-w-md shrink-0 px-2 pb-3 pt-0.5" />
        </div>
      </div>
    </div>
  );
}
