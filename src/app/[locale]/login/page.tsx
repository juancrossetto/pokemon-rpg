"use client";

import { useState, type FormEvent } from "react";
import { signIn } from "next-auth/react";
import { useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/navigation";
import { PokeballIcon } from "@/components/pokeball-icon";
import { BrandLogo } from "@/components/brand-logo";
import { AuthBackdrop } from "@/components/auth-backdrop";
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
    "w-full rounded-xl border border-white/12 bg-black/45 py-3 pl-11 pr-3 text-[16px] text-white outline-none transition placeholder:text-white/35 focus:border-pokeball-red/55 focus:bg-black/55 focus:ring-1 focus:ring-pokeball-red/30";

  return (
    <div className="relative isolate flex min-h-[calc(100dvh-3rem)] flex-1 flex-col md:min-h-[calc(100dvh-4rem)]">
      <AuthBackdrop />

      <div className="relative z-10 flex flex-1 flex-col px-4 sm:px-6">
        <div className="hidden shrink-0 pt-3 text-center md:block md:pt-4">
          <BrandLogo
            alt={tNav("brand")}
            priority
            sizes="180px"
            className="mx-auto h-auto w-[180px] drop-shadow-[0_2px_12px_rgba(0,0,0,0.55)]"
          />
          <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.28em] text-white/45">
            {t("tagline")}
          </p>
        </div>

        <div className="flex flex-1 flex-col items-center justify-center py-4 md:py-6">
          <form onSubmit={handleSubmit} className="w-full max-w-[380px] md:max-w-[420px]">
            <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-[#0c0e14]/92 shadow-[0_24px_64px_rgba(0,0,0,0.55)] backdrop-blur-xl">
              <div
                aria-hidden
                className="pointer-events-none absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-pokeball-red/55 to-transparent"
              />
              <div
                aria-hidden
                className="pointer-events-none absolute -right-16 -top-20 h-40 w-40 rounded-full bg-pokeball-red/10 blur-3xl"
              />

              <div className="relative px-5 pb-1 pt-5 sm:px-6 sm:pt-6">
                <p className="mb-2.5 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-pokeball-red">
                  <span className="h-1.5 w-1.5 rounded-full bg-pokeball-red" />
                  {t("title")}
                </p>
                <h1 className="text-[clamp(1.35rem,5vw,1.85rem)] font-semibold uppercase tracking-[0.04em] text-white">
                  {t("welcomeTitle")}
                </h1>
                <p className="mt-1.5 text-[13px] leading-snug text-white/50">
                  {t("welcomeSubtitle")}
                </p>
              </div>

              <div className="relative space-y-3 px-5 py-5 sm:px-6">
                <label className="block">
                  <span className="sr-only">{t("email")}</span>
                  <div className="relative">
                    <span className="material-symbols-outlined pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[18px]! text-white/40">
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
                    <span className="material-symbols-outlined pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[18px]! text-white/40">
                      lock
                    </span>
                    <input
                      type={showPassword ? "text" : "password"}
                      required
                      autoComplete="current-password"
                      placeholder={t("password")}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className={`${fieldClass} pr-11`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      aria-label={showPassword ? t("hidePassword") : t("showPassword")}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-lg p-1 text-white/40 transition hover:text-white/80"
                    >
                      <span className="material-symbols-outlined text-[18px]!">
                        {showPassword ? "visibility_off" : "visibility"}
                      </span>
                    </button>
                  </div>
                </label>

                <label className="flex cursor-pointer items-center gap-2.5 px-0.5 py-0.5 text-[13px] text-white/55">
                  <input
                    type="checkbox"
                    checked={remember}
                    onChange={(e) => setRemember(e.target.checked)}
                    className="h-3.5 w-3.5 rounded border-white/25 bg-black/50 text-pokeball-red focus:ring-pokeball-red/40"
                  />
                  {t("rememberMe")}
                </label>

                {error ? (
                  <p className="rounded-xl border border-error/30 bg-error/10 px-3 py-2 text-center text-[13px] text-error">
                    {t("error")}
                  </p>
                ) : null}

                <button
                  type="submit"
                  disabled={submitting}
                  className={`game-cta game-cta--red mt-1${submitting ? " game-cta--disabled" : ""}`}
                >
                  <PokeballIcon className="h-4 w-4 shrink-0" />
                  <span className="game-cta__label">
                    {submitting ? t("submitting") : t("submit")}
                  </span>
                </button>

                <p className="pt-1 text-center text-[13px] text-white/45">
                  {t("noAccount")}{" "}
                  <Link
                    href="/register"
                    className="font-semibold text-white/80 underline-offset-2 transition hover:text-white hover:underline"
                  >
                    {t("registerLinkHere")}
                  </Link>
                </p>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
