"use client";

import { useState, type FormEvent } from "react";
import Image from "next/image";
import { signIn } from "next-auth/react";
import { useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/navigation";
import { PokeballIcon } from "@/components/pokeball-icon";

export default function LoginPage() {
  const t = useTranslations("auth.login");
  const tNav = useTranslations("nav");
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
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
      redirect: false,
    });

    setSubmitting(false);
    if (result?.error) {
      setError(true);
      return;
    }
    router.push("/");
    router.refresh();
  }

  return (
    <div className="relative isolate flex min-h-[calc(100dvh-3rem)] flex-1 flex-col md:min-h-[calc(100dvh-4rem)]">
      {/* Fondo fixed a viewport completo — evita franjas / contain roto en mobile */}
      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-[#071018]">
        <Image
          src="/auth/login-mobile.png"
          alt=""
          fill
          priority
          sizes="100vw"
          className="object-cover object-[center_28%] md:hidden"
        />
        <Image
          src="/auth/login-desktop.png"
          alt=""
          fill
          priority
          sizes="100vw"
          className="hidden object-cover object-[center_40%] md:block"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-black/35 to-black/70 md:from-black/40 md:via-black/25 md:to-black/60" />
      </div>

      <div className="relative z-10 flex flex-1 flex-col items-center justify-center px-4 py-6 sm:px-6 md:py-12">
        {/* Marca solo en desktop: en mobile ya está en el header */}
        <div className="mb-6 hidden text-center md:mb-7 md:block">
          <p className="text-display-lg font-black tracking-tighter text-white drop-shadow-[0_2px_12px_rgba(0,0,0,0.55)]">
            <span className="text-electric-yellow">{tNav("brand").split(" ")[0]}</span>{" "}
            <span className="text-white">{tNav("brand").split(" ").slice(1).join(" ")}</span>
          </p>
          <p className="mt-1 text-[11px] font-bold uppercase tracking-[0.28em] text-sky-200/90 drop-shadow">
            {t("tagline")}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="w-full max-w-[380px]">
          <div className="relative rounded-2xl border border-white/15 bg-[#0c1018]/88 p-5 shadow-[0_16px_48px_rgba(0,0,0,0.55)] backdrop-blur-xl md:rounded-[28px] md:border-sky-300/25 md:p-7 md:shadow-[0_0_0_1px_rgba(125,211,252,0.12),0_20px_60px_rgba(0,0,0,0.55),0_0_40px_rgba(56,189,248,0.18)]">
            <div className="relative mb-3 flex justify-center md:mb-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-full border border-white/20 bg-[#12161f] shadow-lg md:h-14 md:w-14 md:border-2">
                <PokeballIcon className="h-7 w-7 md:h-9 md:w-9" />
              </div>
            </div>

            <div className="relative mb-4 text-center md:mb-5">
              <h1 className="text-xl font-bold tracking-tight text-white md:text-headline-md">
                {t("welcomeTitle")}
              </h1>
              <p className="mt-1 text-sm text-white/60 md:text-label-md md:text-on-surface-variant">
                {t("welcomeSubtitle")}
              </p>
            </div>

            <div className="relative space-y-3">
              <label className="block">
                <span className="sr-only">{t("email")}</span>
                <div className="relative">
                  <span className="material-symbols-outlined pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[18px] text-sky-200/70">
                    mail
                  </span>
                  <input
                    type="email"
                    required
                    autoComplete="email"
                    placeholder={t("email")}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full rounded-xl border border-white/15 bg-black/50 py-3 pl-10 pr-3 text-sm text-white outline-none transition placeholder:text-white/35 focus:border-sky-300/60 focus:ring-1 focus:ring-sky-300/40 md:py-3.5 md:pl-11 md:text-label-md"
                  />
                </div>
              </label>

              <label className="block">
                <span className="sr-only">{t("password")}</span>
                <div className="relative">
                  <span className="material-symbols-outlined pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[18px] text-sky-200/70">
                    lock
                  </span>
                  <input
                    type={showPassword ? "text" : "password"}
                    required
                    autoComplete="current-password"
                    placeholder={t("password")}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full rounded-xl border border-white/15 bg-black/50 py-3 pl-10 pr-11 text-sm text-white outline-none transition placeholder:text-white/35 focus:border-sky-300/60 focus:ring-1 focus:ring-sky-300/40 md:py-3.5 md:pl-11 md:pr-12 md:text-label-md"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label={showPassword ? t("hidePassword") : t("showPassword")}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-white/45 transition hover:text-white/80"
                  >
                    <span className="material-symbols-outlined text-[20px]">
                      {showPassword ? "visibility_off" : "visibility"}
                    </span>
                  </button>
                </div>
              </label>

              {error && (
                <p className="rounded-lg border border-error/30 bg-error/10 px-3 py-2 text-center text-label-sm text-error">
                  {t("error")}
                </p>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="mt-1 flex w-full items-center justify-center gap-2 rounded-full bg-pokeball-red px-4 py-3 text-sm font-bold uppercase tracking-wide text-white shadow-[0_10px_28px_rgba(238,21,21,0.35)] transition hover:bg-pokeball-red/90 active:scale-[0.99] disabled:opacity-50 md:py-3.5 md:text-label-md"
              >
                <span className="inline-flex h-5 w-5 items-center justify-center">
                  <PokeballIcon className="h-5 w-5" />
                </span>
                {submitting ? t("submitting") : t("submit")}
              </button>
            </div>

            <div className="relative mt-4 space-y-2.5 text-center text-sm md:mt-5 md:space-y-3 md:text-label-sm">
              <p className="text-white/55">
                {t("noAccount")}{" "}
                <Link
                  href="/register"
                  className="font-semibold text-sky-300 underline-offset-2 hover:text-sky-200 hover:underline"
                >
                  {t("registerLinkHere")}
                </Link>
              </p>
              <Link
                href="/pokedex"
                className="inline-flex items-center gap-1 text-white/45 transition hover:text-white"
              >
                <span className="material-symbols-outlined text-[16px]">auto_stories</span>
                {t("guestAccess")}
              </Link>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
